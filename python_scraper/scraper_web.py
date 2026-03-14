import sys
import json
import asyncio
import hashlib
from pathlib import Path

from playwright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent
SCREENSHOTS_DIR = SCRIPT_DIR.parent / "frontend" / "public" / "screenshots"

EXTRACT_JS = """
() => {
    const selectors = [
        'h1','h2','h3','h4','h5','h6',
        'p','span','a','button',
        'input','textarea','select',
        'img','li',
        'section','header','footer','nav','main',
        'div[class]','div[id]'
    ].join(',');

    const elements = Array.from(document.querySelectorAll(selectors));
    const boxes = [];
    const seen = new Set();
    const pageScrollHeight = document.documentElement.scrollHeight;

    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        // Skip tiny / invisible elements
        if (rect.width < 10 || rect.height < 8) continue;

        // De-duplicate identical bounding boxes
        const key = `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const style = window.getComputedStyle(el);
        const tagName = el.tagName.toLowerCase();

        // Classify element type
        let type = 'container';
        if (['h1','h2','h3','h4','h5','h6','p','span','li'].includes(tagName)) {
            type = 'text';
        } else if (['a','button'].includes(tagName) || el.getAttribute('role') === 'button') {
            type = 'button';
        } else if (tagName === 'img') {
            type = 'image';
        } else if (['input','textarea','select'].includes(tagName)) {
            type = 'input';
        } else if (style.backgroundImage && style.backgroundImage !== 'none') {
            type = 'background-image';
        }

        // Absolute Y (accounts for scroll)
        const absY = rect.top + window.scrollY;
        if (absY + rect.height < 0 || absY > pageScrollHeight + 200) continue;

        const bgImage = (style.backgroundImage && style.backgroundImage !== 'none')
            ? style.backgroundImage.substring(0, 200)
            : undefined;
        const src = (el.src || el.getAttribute('src')) || undefined;
        const text = (el.innerText || el.alt || el.placeholder || '').trim().substring(0, 300);

        boxes.push({
            type,
            tagName,
            text,
            x: Math.round(rect.left),
            y: Math.round(absY),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            backgroundColor: style.backgroundColor,
            backgroundImage: bgImage,
            src: src ? src.substring(0, 200) : undefined,
        });

        if (boxes.length >= 350) break;
    }
    return boxes;
}
"""


async def scrape(url: str) -> dict:
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        try:
            await page.goto(url, wait_until="networkidle", timeout=30_000)
        except Exception:
            # Fallback – accept even partial loads
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
            except Exception:
                pass

        page_width: int = await page.evaluate(
            "Math.min(Math.max(document.documentElement.scrollWidth, 1440), 1920)"
        )
        page_height: int = await page.evaluate("document.documentElement.scrollHeight")

        # Resize viewport to capture the full page in one screenshot
        capped_height = min(page_height, 12_000)
        await page.set_viewport_size({"width": min(page_width, 1440), "height": capped_height})
        await page.wait_for_timeout(500)

        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        screenshot_filename = f"web_{url_hash}.png"
        screenshot_path = SCREENSHOTS_DIR / screenshot_filename
        await page.screenshot(path=str(screenshot_path), full_page=True)

        boxes = await page.evaluate(EXTRACT_JS)
        await browser.close()

    return {
        "screenshotUrl": f"/screenshots/{screenshot_filename}",
        "boxes": boxes,
        "pageHeight": page_height,
        "pageWidth": min(page_width, 1440),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL argument required."}))
        sys.exit(1)

    target_url = sys.argv[1]
    try:
        result = asyncio.run(scrape(target_url))
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
