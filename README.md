# FunnelVision

Audit landing pages and sales funnels with the **FLOW framework**: get a full-page screenshot, element overlays, and AI-powered conversion feedback (OpenAI) on every text, image, and button.

## Features

- **Scrape** any public URL: full-page screenshot + bounding boxes for text, images, and buttons
- **FLOW analysis** (OpenAI): each element is scored against four categories:
  - **Friction** — hidden CTAs, too many steps, form friction
  - **Legitimacy** — missing proof, weak authority
  - **Offer Clarity** — jargon, unclear value, buried benefits
  - **Willingness** — no guarantee, weak urgency, missing FAQs
- **12 conversion principles** — analysis references simplicity, speed-to-value, contrast, authority, barrier removal, value stacking, scarcity, risk reversal, peer proof, transformation, accessibility, momentum
- **Inspector** — click or hover any overlay to see element data, issue, fix, and principle-based breakdown
- **Flow health score** (0–100) and per-category leak counts

## Tech stack

- **Frontend**: React, Vite, Tailwind CSS, Motion
- **Server**: Node.js, Express, `tsx`; serves Vite in dev and static build in prod
- **Scraper**: Python (Playwright), run as a subprocess from the Node server
- **LLM**: OpenAI API (e.g. `gpt-4o-mini`) for FLOW annotations

## Prerequisites

- **Node.js** 18+
- **Python** 3.12+ (for the scraper)
- **OpenAI API key** ([platform.openai.com](https://platform.openai.com))

## Setup

### 1. Clone and install Node dependencies

```bash
git clone https://github.com/dakshmakkar6-code/funnel-vision.git
cd funnel-vision/frontend
npm install
```

### 2. Python scraper (venv + Playwright)

```bash
cd python_scraper
uv venv
uv sync
uv run playwright install chromium
```

Or with pip:

```bash
cd python_scraper
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -e .
playwright install chromium
```

### 3. Environment variables

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env` and set:

```env
OPENAI_API_KEY=sk-your-openai-api-key
PORT=3000
```

Optional: `OPENAI_MODEL`, `LLM_REQUEST_TIMEOUT_MS`, `MAX_ELEMENTS_TO_ANALYZE` (see `.env.example`).

## Run

**Development**

```bash
cd frontend
npm run dev
```

Then open **http://localhost:3000**, enter a landing page URL, and click **Audit Page**.

**Production build**

```bash
cd frontend
npm run build
NODE_ENV=production npm run dev
```

## Project structure

```
funnel-vision/
├── frontend/           # Node + React app
│   ├── server.ts       # Express server, /api/audit, /api/analyze
│   ├── scraper.ts      # Spawns Python scraper
│   ├── src/
│   │   ├── App.tsx     # UI, overlays, Inspector
│   │   ├── llmClient.ts # OpenAI client, FLOW prompts, batching
│   │   ├── types.ts
│   │   └── safeJson.ts
│   └── .env.example
├── python_scraper/     # Playwright scraper
│   ├── scraper_web.py  # Full-page screenshot + text/image/button boxes
│   └── tests/
└── docs/               # TESTING.md, PERSISTENCE.md
```

## API

- `POST /api/audit` — body: `{ "url": "https://example.com" }` → scrape result (screenshot URL, boxes, page size)
- `POST /api/analyze` — body: `{ "url", "scrapeResult" }` → `{ "annotations" }` (FLOW analysis per element)
- `GET /api/health` → `{ "status": "ok" }`

## Testing

**Python (scraper)**

```bash
cd python_scraper
uv run pytest tests/ -v
```

Uses the project venv; requires Playwright and Chromium installed.

## License

Private / unlicensed unless stated otherwise.
