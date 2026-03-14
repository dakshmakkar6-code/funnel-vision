import { jsonrepair } from "jsonrepair";

/** Remove trailing commas before ] or } (common LLM/scraper output issue) */
function removeTrailingCommas(s: string): string {
  return s.replace(/,(\s*[\]}])/g, "$1");
}

/** Replace unescaped newlines inside double-quoted strings with \\n */
function fixUnescapedNewlinesInStrings(s: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let escape = false;
  let quote = "";
  while (i < s.length) {
    const c = s[i];
    if (escape) {
      result += c;
      escape = false;
      i++;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        result += c;
        escape = true;
        i++;
      } else if (c === quote) {
        result += c;
        inString = false;
        i++;
      } else if (c === "\n" || c === "\r") {
        result += "\\n";
        if (c === "\r" && s[i + 1] === "\n") i++;
        i++;
      } else {
        result += c;
        i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      result += c;
      inString = true;
      quote = c;
      i++;
    } else {
      result += c;
      i++;
    }
  }
  return result;
}

function tryParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

/**
 * Parse JSON with automatic repair for common issues (trailing commas,
 * unescaped newlines in strings, missing commas, etc.). Use for LLM output,
 * Python scraper output, or any external JSON that may be malformed.
 */
export function safeParseJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty or whitespace-only input");
  }

  // 1. Direct parse (fast path)
  let parsed = tryParse<T>(trimmed);
  if (parsed !== null) return parsed;

  // 2. Fix trailing commas, then parse
  const noTrailing = removeTrailingCommas(trimmed);
  parsed = tryParse<T>(noTrailing);
  if (parsed !== null) return parsed;

  // 3. Fix unescaped newlines in strings, then parse
  const fixedNewlines = fixUnescapedNewlinesInStrings(trimmed);
  parsed = tryParse<T>(fixedNewlines);
  if (parsed !== null) return parsed;

  // 4. Fix both, then parse
  const bothFixed = fixUnescapedNewlinesInStrings(removeTrailingCommas(trimmed));
  parsed = tryParse<T>(bothFixed);
  if (parsed !== null) return parsed;

  // 5. jsonrepair
  try {
    const repaired = jsonrepair(trimmed);
    parsed = tryParse<T>(repaired);
    if (parsed !== null) return parsed;
    // jsonrepair output still invalid - try our fixes on it
    const repairedThenFixed = removeTrailingCommas(
      fixUnescapedNewlinesInStrings(repaired)
    );
    parsed = tryParse<T>(repairedThenFixed);
    if (parsed !== null) return parsed;
  } catch {
    // jsonrepair threw
  }

  throw new Error(
    "JSON parse failed after all repair attempts (trailing commas, unescaped newlines, jsonrepair)"
  );
}
