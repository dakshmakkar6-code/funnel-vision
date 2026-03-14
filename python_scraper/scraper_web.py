import sys
import json
import re
import asyncio
import hashlib
from pathlib import Path

from playwright.async_api import async_playwright

# Control chars and problematic sequences that can break JSON parsing
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _sanitize_str(s: str) -> str:
    """Replace control characters that can break JSON in external parsers."""
    if not isinstance(s, str):
        return s
    return _CONTROL_CHAR_RE.sub(" ", s)


def _sanitize_value(obj):
    """Recursively sanitize string values in dicts/lists for safe JSON output."""
    if isinstance(obj, dict):
        return {k: _sanitize_value(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_value(v) for v in obj]
    if isinstance(obj, str):
        return _sanitize_str(obj)
    return obj

SCRIPT_DIR = Path(__file__).parent
SCREENSHOTS_DIR = SCRIPT_DIR.parent / "frontend" / "public" / "screenshots"

EXTRACT_JS = """
() => {
    // Every text, image, button, input, and meaningful container for full overlay coverage
    const selectors = [
        'h1','h2','h3','h4','h5','h6',
        'p','span','a','button','label','strong','em','blockquote',
        'input','textarea','select',
        'img','li',
        'section','header','footer','nav','main','article','aside',
        'div[class]','div[id]'
    ].join(',');

    const elements = Array.from(document.querySelectorAll(selectors));
    const boxes = [];
    const seen = new Set();
    const pageScrollHeight = document.documentElement.scrollHeight;

    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        // Skip tiny / invisible (slightly lower bar to catch small labels/icons)
        if (rect.width < 8 || rect.height < 6) continue;

        // De-duplicate identical bounding boxes
        const key = `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const style = window.getComputedStyle(el);
        const tagName = el.tagName.toLowerCase();

        // Classify element type: only scrape text, image, button for reliable data and fewer elements
        let type = 'container';
        if (['h1','h2','h3','h4','h5','h6','p','span','li','label','strong','em','blockquote'].includes(tagName)) {
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

        // Only keep text, image, and button so scrape is focused and analysis stays fast
        if (type !== 'text' && type !== 'image' && type !== 'button') continue;

        // Absolute Y (accounts for scroll)
        const absY = rect.top + window.scrollY;
        if (absY + rect.height < 0 || absY > pageScrollHeight + 200) continue;

        const bgImage = (style.backgroundImage && style.backgroundImage !== 'none')
            ? style.backgroundImage.substring(0, 200)
            : undefined;
        const src = (el.src || el.getAttribute('src')) || undefined;
        const alt = (el.getAttribute && el.getAttribute('alt')) || undefined;
        // For images use alt as primary text; for others use innerText so text is scraped properly
        const textFull = (tagName === 'img' ? (alt || '') : (el.innerText || el.placeholder || '')).trim();
        const textPreview = textFull.substring(0, 300);

        const role = el.getAttribute('role');
        const ariaLabel = el.getAttribute('aria-label');
        const href = el.getAttribute('href');
        const name = el.getAttribute('name');
        const placeholder = el.getAttribute('placeholder');
        const inputType = el.getAttribute('type');

        const section = el.closest('section, main, article, header, footer');
        const sectionId = section ? section.id || null : null;
        let sectionHeading = null;
        if (section) {
            const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading && heading.textContent) {
                sectionHeading = heading.textContent.trim().substring(0, 160);
            }
        }

        let foldZone = "lower";
        if (absY < 600) foldZone = "above-fold";
        else if (absY < 1400) foldZone = "upper-mid";
        else if (absY < 2800) foldZone = "mid";

        boxes.push({
            type,
            tagName,
            text: textFull,
            textPreview,
            role,
            ariaLabel,
            href,
            name,
            placeholder,
            inputType,
            sectionId,
            sectionHeading,
            foldZone,
            x: Math.round(rect.left),
            y: Math.round(absY),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            backgroundColor: style.backgroundColor,
            border: style.border,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            textAlign: style.textAlign,
            zIndex: style.zIndex,
            backgroundImage: bgImage,
            src: src ? src.substring(0, 200) : undefined,
            alt: alt ? alt.substring(0, 200) : undefined,
        });

        if (boxes.length >= 500) break;
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
        sanitized = _sanitize_value(result)
        print(json.dumps(sanitized))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
