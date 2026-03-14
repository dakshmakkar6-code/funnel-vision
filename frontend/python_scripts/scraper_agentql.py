import asyncio
import json
import sys
import logging
from pathlib import Path

# Add current directory to path
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

try:
    from playwright.async_api import async_playwright
    import agentql
except ImportError as e:
    # If imports fail at runtime, we provide a clear error for the Node.js caller
    print(json.dumps({"error": f"Missing dependencies: {str(e)}"}))
    sys.exit(1)

async def scrape_page(url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Using agentql.wrap_async though standard query features aren't used yet
        page = await agentql.wrap_async(browser.new_page())
        await page.goto(url, wait_until="networkidle")
        
        # Save screenshot to public directory relative to this script
        public_dir = Path(__file__).parent.parent / "public" / "screenshots"
        public_dir.mkdir(parents=True, exist_ok=True)
        
        # Create a safe filename based on the URL
        safe_name = "".join(c if c.isalnum() else "_" for c in url)[:30]
        screenshot_filename = f"screenshot-{safe_name}.png"
        screenshot_path = public_dir / screenshot_filename
        
        await page.screenshot(path=str(screenshot_path), full_page=True)

        # Extract bounding boxes
        boxes = await page.evaluate('''() => {
            const elements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, button, .btn, img, section, div, form, input, select, textarea, article, header, footer'));
            return elements.map(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const tagName = el.tagName.toLowerCase();
                
                let type = 'container';
                if (['button', 'a'].includes(tagName) || el.classList.contains('btn')) type = 'button';
                else if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'strong', 'em'].includes(tagName)) type = 'text';
                else if (tagName === 'img') type = 'image';
                else if (['form', 'input', 'select', 'textarea'].includes(tagName)) type = 'input';
                else if (style.backgroundImage && style.backgroundImage !== 'none') type = 'background-image';

                let content = el.innerText?.trim() || '';
                if (tagName === 'img') content = el.alt || el.src || 'Image';
                else if (tagName === 'input' || tagName === 'textarea') content = el.placeholder || el.value || 'Input field';

                return {
                    type, tagName, text: content,
                    x: rect.x + window.scrollX, y: rect.y + window.scrollY,
                    width: rect.width, height: rect.height,
                    fontSize: style.fontSize, fontWeight: style.fontWeight,
                    color: style.color, backgroundColor: style.backgroundColor,
                    backgroundImage: style.backgroundImage !== 'none' ? style.backgroundImage : null,
                    src: tagName === 'img' ? el.src : null
                };
            }).filter(box => box.width > 5 && box.height > 5 && box.color !== 'rgba(0, 0, 0, 0)' && (box.text || box.type === 'image' || box.type === 'background-image' || box.type === 'input'));
        }''')

        # Get page dimensions
        dimensions = await page.evaluate('''() => {
            return { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
        }''')

        await browser.close()
        
        return {
            "screenshotUrl": f"/screenshots/{screenshot_filename}",
            "boxes": boxes,
            "pageWidth": dimensions["width"],
            "pageHeight": dimensions["height"]
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL argument is required"}))
        sys.exit(1)
        
    url = sys.argv[1]
    try:
        result = asyncio.run(scrape_page(url))
        # Print ONLY the JSON to stdout so Node.js can parse it
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
