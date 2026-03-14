import { safeParseJson } from "./safeJson";
import type { Annotation, FunnelScrapeResult, ScrapedElement } from "./types";

export type ProviderId = "openai";

export interface AnalyzeFunnelOptions {
  provider?: ProviderId;
  url: string;
}

export interface AnalyzeFunnelResponse {
  annotations: Annotation[];
}

const BATCH_SIZE = 45;
const MAX_TEXT_PREVIEW = 100;
const BATCH_DELAY_MS = 400;
const MAX_RETRIES = 2;
/** Cap elements analyzed so analysis finishes in time (fewer batches = faster, less timeout risk). */
const MAX_ELEMENTS_TO_ANALYZE = Number(process.env.MAX_ELEMENTS_TO_ANALYZE) || 120;
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS) || 90_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatElementForPrompt(
  stepIndex: number,
  boxIndex: number,
  el: ScrapedElement | Record<string, unknown>
): string {
  const rawText = (el as any).textContentPreview ?? (el as any).textContentFull ?? (el as any).text ?? "";
  const text =
    String(rawText).length > MAX_TEXT_PREVIEW
      ? String(rawText).slice(0, MAX_TEXT_PREVIEW) + "..."
      : String(rawText);
  const layout = (el as any).layout ?? el;
  const location = layout?.foldZone ?? "unknown-zone";
  const section = (el as any).sectionHeading ?? (el as any).sectionId ?? "";
  const styles = (el as any).styles ?? {};
  const tagName = (el as any).tagName ?? "?";
  const type = (el as any).type ?? "unknown";
  const href = (el as any).href ?? "";
  const ariaLabel = (el as any).ariaLabel ?? "";
  const placeholder = (el as any).placeholder ?? "";
  const alt = (el as any).images?.alt ?? (el as any).alt ?? "";
  const visual = [styles.fontSize, styles.fontWeight, styles.color].filter(Boolean).join(", ");

  let line = `[Step ${stepIndex} / Element ${boxIndex}] <${tagName}> type=${type} zone=${location}`;
  if (section) line += ` section="${section}"`;
  if (visual) line += ` style: ${visual}`;
  if (text) line += ` text: "${text}"`;
  if (href) line += ` href="${String(href).slice(0, 80)}"`;
  if (ariaLabel) line += ` aria-label="${ariaLabel}"`;
  if (placeholder) line += ` placeholder="${placeholder}"`;
  if (alt) line += ` alt="${alt}"`;
  return line;
}

const FLOW_PRINCIPLES = `12 CONVERSION PRINCIPLES (reference for detailed_flow_analysis — cite by number in your analysis):
1.Simplicity: complex doesn't sell; simple steps, quick wins, "no tech needed". 2.Speed-to-Value: shortest believable timeframe, instant access. 3.Contrast: old vs new, myths vs facts. 4.Authority: borrow credibility, big names, proven results. 5.Barrier Removal: eliminate excuses (no audience, no experience). 6.Value Stacking: price seems small vs total value, bonuses. 7.Scarcity/Urgency: countdown, limited spots, price rise. 8.Risk Reversal: guarantee, "keep it if you refund". 9.Peer Proof: people like me succeeding, testimonials. 10.Transformation: sell outcome not process, "what you'll become". 11.Accessibility: success feels achievable for ordinary people. 12.Momentum: multiple CTAs, progressive value, buy buttons near proof.
SALES PAGE: Above-the-fold = CTA + headline + visual. Show don't tell; heavy visuals; social proof near top; buy button every section; guarantee near CTA; clarity (no confusion); human photo; FAQ; disclaimer/legal/contact.`;

const ELEMENT_TYPE_GUIDANCE = `Analyze deeply by element type:
- Buttons/CTAs (a, button): Friction (visibility, clarity, placement), Willingness (urgency, risk reversal). Is copy benefit-led? Above the fold? Near proof? Principle 12 (Momentum).
- Images (img, background-image): Legitimacy (social proof, human face, credibility), Offer Clarity (show don't tell). Alt text for clarity/accessibility? Principle 4, 9.
- Headlines (h1–h6): Offer Clarity (one clear idea), Transformation (outcome not process), Simplicity. Principle 1, 10.
- Body text (p, span): Offer Clarity (jargon, buried value), Peer Proof, Authority. Principle 4, 9, 10.
- Inputs/forms: Friction (fields, steps), Barrier Removal. Principle 5.
For every element: name which principle(s) apply, whether it supports or violates them, and concrete "show vs tell" or copy/design suggestions.`;

const SYSTEM_PROMPT = `You are the FunnelVision Architect. Use the FLOW Framework and the 12 conversion principles. Go deep: every element gets a detailed, principle-based analysis.

FLOW categories: Friction (hidden CTAs, too many steps, form friction) | Legitimacy (missing proof, weak authority) | Offer Clarity (jargon, unclear value, buried benefits) | Willingness (no guarantee, weak urgency, no FAQ).

${FLOW_PRINCIPLES}

${ELEMENT_TYPE_GUIDANCE}

For EVERY element in the batch output ONE annotation. No skips. Be thorough: every text, image, and button must be evaluated against FLOW and the 12 principles.

For a LEAK: "pass": false, category, exact_quote (quote the element text/copy where relevant), issue_description (2-4 sentences: what's wrong and why it hurts conversion), actionable_improvement (concrete copy or design fix), "score" 1-100 (1-30 minor, 31-60 moderate, 61-100 critical), and "detailed_flow_analysis": 3-5 sentences naming which principle numbers apply, how this element supports or violates them, and specific show-vs-tell or rewrite suggestions (e.g. "Violates Principle 9 (Peer Proof): no testimonial near CTA. Add a one-line result. Principle 12: move buy button closer to guarantee.").

For NO issue: "pass": true, category "Legitimacy", issue_description "", actionable_improvement "", brief_reason (1-2 sentences), "score": 0, and "detailed_flow_analysis": 2-3 sentences naming which principles this element aligns with and why it works (e.g. "Principles 1 and 10: clear headline sells outcome. Principle 12: CTA visible above fold.").

Respond ONLY with valid JSON. No trailing commas. Use \\n for newlines in strings.
{
  "annotations": [
    {
      "stepIndex": <int>,
      "boxIndex": <int>,
      "pass": <boolean>,
      "score": <int 0-100>,
      "category": "Friction|Legitimacy|Offer Clarity|Willingness",
      "exact_quote": "<string or empty>",
      "issue_description": "<string>",
      "actionable_improvement": "<string>",
      "brief_reason": "<string if pass>",
      "detailed_flow_analysis": "<string: principle-based analysis for every element>"
    }
  ]
}`;

/** Strip markdown code fences and any leading text so we can parse raw JSON. */
function extractJson(text: string): string {
  let s = text.trim();
  const openIdx = s.indexOf("```");
  if (openIdx !== -1) {
    s = s.slice(openIdx);
    const openMatch = s.match(/^```\s*(?:json)?\s*\n?/);
    if (openMatch) {
      s = s.slice(openMatch[0].length).trim();
    }
    const closeIdx = s.lastIndexOf("```");
    if (closeIdx !== -1) {
      s = s.slice(0, closeIdx).trim();
    }
  }
  return s;
}

/** Find matching closing brace for the { at startIdx. Respects strings so we don't count { } inside values. */
function findMatchingBrace(s: string, startIdx: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  let stringChar = "";
  for (let i = startIdx; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === stringChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Parse annotations by extracting each { ... } object and parsing individually. Survives one bad element. */
function parseAnnotationsFromRaw(raw: string): Annotation[] {
  const annotations: Annotation[] = [];
  const arrayStart = raw.indexOf('"annotations"');
  if (arrayStart === -1) return annotations;
  const bracketStart = raw.indexOf("[", arrayStart);
  if (bracketStart === -1) return annotations;

  let pos = bracketStart + 1;
  while (pos < raw.length) {
    const openIdx = raw.indexOf("{", pos);
    if (openIdx === -1) break;
    const closeIdx = findMatchingBrace(raw, openIdx);
    if (closeIdx === -1) break;
    const slice = raw.slice(openIdx, closeIdx + 1);
    try {
      const obj = safeParseJson<Record<string, unknown>>(slice);
      if (typeof obj.stepIndex === "number" && typeof obj.boxIndex === "number") {
        const scoreNum = typeof obj.score === "number" ? Math.max(0, Math.min(100, obj.score)) : undefined;
        annotations.push({
          stepIndex: obj.stepIndex,
          boxIndex: obj.boxIndex,
          category: (obj.category ?? "Legitimacy") as Annotation["category"],
          exact_quote: obj.exact_quote as string | undefined,
          issue_description: String(obj.issue_description ?? ""),
          actionable_improvement: String(obj.actionable_improvement ?? ""),
          pass: obj.pass === true,
          brief_reason: obj.brief_reason as string | undefined,
          score: scoreNum,
          detailed_flow_analysis: typeof obj.detailed_flow_analysis === "string" ? obj.detailed_flow_analysis : undefined,
        });
      }
    } catch {
      // skip malformed object and continue
    }
    pos = closeIdx + 1;
  }
  return annotations;
}

/** OpenAI-compatible chat request/response format. */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function buildChatBody(system: string, user: string, model: string) {
  const messages: ChatMessage[] = system
    ? [{ role: "system", content: system }, { role: "user", content: user }]
    : [{ role: "user", content: user }];
  return { model, max_tokens: 4096, messages };
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  return fetch(url, { ...options, signal: ac.signal })
    .finally(() => clearTimeout(t))
    .catch((err: unknown) => {
      if (err && typeof err === "object" && (err as Error).name === "AbortError") {
        throw new Error("Analysis timed out. Try again.");
      }
      throw err;
    });
}

async function callOpenAI(messages: ChatMessage[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Promise.reject(new Error("OPENAI_API_KEY not set"));
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const body = buildChatBody(system, user, model);
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      },
      REQUEST_TIMEOUT_MS
    );
    if (res.ok) {
      const text = await res.text();
      const data = safeParseJson<{ choices?: { message?: { content?: string } }[] }>(text);
      return data.choices?.[0]?.message?.content ?? "";
    }
    const errText = await res.text();
    lastErr = new Error(`OpenAI API ${res.status}: ${errText}`);
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      const waitMs = Math.min(3000 * Math.pow(2, attempt), 10000);
      await sleep(waitMs);
    } else {
      throw lastErr;
    }
  }
  throw lastErr;
}

async function callLLM(
  messages: { role: "user" | "system"; content: string }[]
): Promise<string> {
  const chatMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role as "system" | "user",
    content: m.content,
  }));
  return callOpenAI(chatMessages);
}

export class LlmClient {
  async analyzeFunnel(
    scrapeResult: FunnelScrapeResult,
    { url }: AnalyzeFunnelOptions
  ): Promise<AnalyzeFunnelResponse> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Set OPENAI_API_KEY in frontend/.env");
    }

    // Collect ALL elements for annotations; only analyze text, image, button (fewer batches = no timeout)
    const items: { stepIndex: number; boxIndex: number; el: ScrapedElement | Record<string, unknown> }[] = [];
    scrapeResult.steps.forEach((step, stepIndex) => {
      step.elements.forEach((el, boxIndex) => {
        items.push({ stepIndex, boxIndex, el });
      });
    });

    if (items.length === 0) {
      return { annotations: [] };
    }

    const focusTypes = ["text", "image", "button"];
    const itemsToAnalyze = items
      .filter((i) => focusTypes.includes((i.el as any).type ?? ""))
      .slice(0, MAX_ELEMENTS_TO_ANALYZE);
    const allAnnotations: Annotation[] = [];
    const batches: typeof items[] = [];

    for (let i = 0; i < itemsToAnalyze.length; i += BATCH_SIZE) {
      batches.push(itemsToAnalyze.slice(i, i + BATCH_SIZE));
    }

    const runBatch = async (userPrompt: string): Promise<Annotation[]> => {
      const text = await callLLM([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);
      const raw = extractJson(text);
      const annotations = parseAnnotationsFromRaw(raw);
      if (annotations.length > 0) {
        return annotations;
      }
      // Fallback: try full-doc parse once
      try {
        const parsed = safeParseJson<{ annotations?: unknown[] }>(raw);
        const arr = Array.isArray(parsed.annotations) ? parsed.annotations : [];
        return arr
          .filter((a: any) => typeof a?.stepIndex === "number" && typeof a?.boxIndex === "number")
          .map((a: any) => {
            const scoreNum = typeof a?.score === "number" ? Math.max(0, Math.min(100, a.score)) : undefined;
            return {
              stepIndex: a.stepIndex,
              boxIndex: a.boxIndex,
              category: (a.category ?? "Legitimacy") as Annotation["category"],
              exact_quote: a.exact_quote,
              issue_description: a.issue_description ?? "",
              actionable_improvement: a.actionable_improvement ?? "",
              pass: a.pass === true,
              brief_reason: a.brief_reason,
              score: scoreNum,
              detailed_flow_analysis: typeof a?.detailed_flow_analysis === "string" ? a.detailed_flow_analysis : undefined,
            };
          });
      } catch {
        return [];
      }
    };

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const elementsSummary = batch.map(({ stepIndex, boxIndex, el }) =>
        formatElementForPrompt(stepIndex, boxIndex, el)
      );

      const userPrompt = `Analyze EVERY element in this batch for the funnel at ${url}. Batch ${b + 1}/${batches.length} (${batch.length} elements):

${elementsSummary.join("\n")}`;

      const batchAnnotations = await runBatch(userPrompt);
      allAnnotations.push(...batchAnnotations);

      if (b < batches.length - 1) await sleep(100);
    }

    // Fill missing annotations (LLM skips or element was beyond cap)
    const seen = new Set(allAnnotations.map((a) => `${a.stepIndex}:${a.boxIndex}`));
    const skipReason =
      items.length > MAX_ELEMENTS_TO_ANALYZE
        ? `Not analyzed (first ${MAX_ELEMENTS_TO_ANALYZE} elements only for speed).`
        : "Analysis skipped or inconclusive for this element.";
    for (const { stepIndex, boxIndex } of items) {
      const key = `${stepIndex}:${boxIndex}`;
      if (!seen.has(key)) {
        seen.add(key);
        allAnnotations.push({
          stepIndex,
          boxIndex,
          category: "Legitimacy",
          issue_description: "",
          actionable_improvement: "",
          pass: true,
          brief_reason: skipReason,
          score: 0,
          detailed_flow_analysis: undefined,
        });
      }
    }

    return { annotations: allAnnotations };
  }
}
