# FunnelVision

Landing pages often leak conversion without it being obvious where. FunnelVision runs a page through the FLOW framework and tells you exactly which elements hurt clarity, trust, or willingness to act—with a screenshot, overlays, and concrete fixes.

## The problem

Sales and landing pages fail when they add friction, lack proof, bury the offer, or don’t address risk. Fixing that usually means guesswork or expensive audits. This tool scrapes the page, sends text and CTAs to an LLM, and maps feedback back onto the layout so you can see what to change.

## How it works

1. You enter a URL and hit **Audit Page**.
2. A headless browser (Playwright) captures a full-page screenshot and extracts every text block, image, and button.
3. The Node server sends those elements to OpenAI in batches; the model scores each against FLOW (Friction, Legitimacy, Offer Clarity, Willingness) and the 12 conversion principles.
4. The UI shows the screenshot with overlays. Click or hover an element to see the Inspector: issue, suggested fix, and which principles apply.

**Flow:** Browser → Node (Express) → Python scraper (screenshot + boxes) → Node → OpenAI → annotations back to the client. No database; scrape and analysis are on demand.

## What you need

- Node 18+, Python 3.12+, an OpenAI API key
- Chromium for Playwright: `cd python_scraper && uv run playwright install chromium` (or equivalent with pip)

## Setup

```bash
git clone https://github.com/dakshmakkar6-code/funnel-vision.git
cd funnel-vision/frontend
npm install
```

Python scraper (from repo root):

```bash
cd python_scraper
uv venv && uv sync
uv run playwright install chromium
```

Copy `frontend/.env.example` to `frontend/.env` and set `OPENAI_API_KEY`. Optionally set `PORT`, `OPENAI_MODEL`, `LLM_REQUEST_TIMEOUT_MS`, `MAX_ELEMENTS_TO_ANALYZE`.

## Run

```bash
cd frontend
npm run dev
```

Open http://localhost:3000, paste a landing page URL, click **Audit Page**.

Production: `npm run build` then run the server with `NODE_ENV=production`.

## FLOW categories

- **Friction** — CTAs hard to find, too many steps, form friction  
- **Legitimacy** — Weak or missing proof, authority  
- **Offer Clarity** — Jargon, unclear value, benefits buried  
- **Willingness** — No guarantee, weak urgency, no FAQ  

The model also ties feedback to principles (simplicity, speed-to-value, contrast, authority, barrier removal, value stacking, scarcity, risk reversal, peer proof, transformation, accessibility, momentum).

## API

- `POST /api/audit` — `{ "url": "https://..." }` → screenshot URL, boxes (text/image/button), page dimensions  
- `POST /api/analyze` — `{ "url", "scrapeResult" }` → `{ "annotations" }` per element  
- `GET /api/health` — `{ "status": "ok" }`  

## Tests

Scraper tests (from `python_scraper`):

```bash
uv run pytest tests/ -v
```

## License

MIT
