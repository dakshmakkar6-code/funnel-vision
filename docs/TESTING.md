# FunnelVision – Testing and QA

## Provider and config

- No LLM keys required (scraping only).
- **PORT**: Default 3000; override for frontend server.

## Automated tests

### Python (scraper)

- **Location**: `python_scraper/tests/test_scraper_web.py`
- **Run**: `cd python_scraper && uv run pytest tests/ -v`
- **What it does**: Asserts that `scrape()` returns a dict with `screenshotUrl`, `boxes`, `pageHeight`, `pageWidth`, and that each box has required fields (`type`, `tagName`, `x`, `y`, `width`, `height`). Uses a real URL (e.g. https://example.com) with a short timeout.

### Node (optional)

- No test runner is currently configured. To add later:
  - Use Vitest or Jest.
  - Mock `scrapePage()` and the LLM client; call `POST /api/audit` and `POST /api/analyze` with fixture payloads and assert response shape and status.

## Manual test plan

1. **Single-page audit**
   - Enter a landing page URL (e.g. https://example.com or a real coaching/sales page).
   - Click “Audit Page”.
   - Confirm: screenshot loads, bounding boxes appear, left sidebar shows “Total Leaks Found” and FLOW counts, and clicking/hovering a box shows the Inspector with element data and (if analyzed) FLOW issue + fix.

2. **Multi-step funnel** (when supported)
   - Use a flow that passes multiple URLs (e.g. via future “Add step” or CSV).
   - Confirm: step selector (tabs) appears, switching steps changes screenshot and boxes, and FLOW summary shows per-step counts.

3. **Error handling**
   - Invalid URL: expect validation message.
   - Scraper failure (e.g. unreachable host): expect “Failed to scrape page” or similar.
   - AI failure (e.g. missing API key or rate limit): expect “AI analysis failed”; screenshot and boxes should still appear when scrape succeeded.

4. **Inspector**
   - For an element with an AI annotation: Inspector shows FLOW category, “The Leak”, and “The Fix”.
   - For a low-priority element: Inspector shows “No FLOW analysis” and the short explanation.
   - Fold zone and font/style hints appear when available.
