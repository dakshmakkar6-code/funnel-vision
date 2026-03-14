import asyncio
import json
import logging
import sys
from pathlib import Path

# Add the directory containing this script to the Python path
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

try:
    from scraper import scrape_page, collect_text_and_button_boxes
    from report_generator import generate_teardown_report
except ImportError:
    # Fallback for some IDE environments
    sys.path.append(str(CURRENT_DIR))
    from scraper import scrape_page, collect_text_and_button_boxes
    from report_generator import generate_teardown_report

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_full_scrape(url: str) -> dict:
    """Helper to run both scraping and box collection."""
    logger.info(f"Starting scrape for: {url}")
    scrape_result = await scrape_page(url)
    box_result = await collect_text_and_button_boxes(url)
    
    payload = {
        "scrape_page": scrape_result,
        "collect_text_and_button_boxes": box_result,
    }
    
    script_dir = Path(__file__).parent
    output_path = script_dir / "scrape_results.json"
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    logger.info(f"Saved scrape results to {output_path}")
    return payload

def main() -> None:
    script_dir = Path(__file__).parent
    results_file = script_dir / "scrape_results.json"
    
    if not results_file.exists():
        logger.error(f"Scrape results not found at {results_file}. Please run a scrape first.")
        return

    scrape_results = json.loads(results_file.read_text(encoding="utf-8"))
    scrape_page_result = scrape_results.get("scrape_page", {})
    box_result = scrape_results.get("collect_text_and_button_boxes", {})

    image_paths = scrape_page_result.get("screenshot_paths") or []
    if not image_paths:
        fallback_image = scrape_page_result.get("screenshot_path")
        if fallback_image:
            image_paths = [fallback_image]
    
    if not image_paths:
        screenshots_dir = script_dir / "page_screenshots"
        fallback_images = sorted(screenshots_dir.glob("*.png"))
        image_paths = [str(path) for path in fallback_images]
    
    if not image_paths:
        logger.error("No screenshots found. Please ensure photos are in 'page_screenshots' or 'scrape_results.json'.")
        return

    text_boxes = box_result.get("text_boxes", [])
    button_boxes = box_result.get("button_boxes", [])
    raw_boxes = [*text_boxes, *button_boxes]
    
    bounding_boxes = [
        {
            "x": box.get("x"),
            "y": box.get("y"),
            "width": box.get("width"),
            "height": box.get("height"),
        }
        for box in raw_boxes
        if isinstance(box, dict) and all(k in box for k in ("x", "y", "width", "height"))
    ]

    flow_analysis = {
        "Friction": "The headline is clear but the call-to-action button is not prominent.",
        "Legitimacy": "The page looks professional and trustworthy.",
        "Offer Clarity": "The offer is somewhat clear but could be more specific.",
        "Willingness to Buy": "Users may be hesitant due to lack of urgency or incentives."
    }
    
    report_path = generate_teardown_report(image_paths, bounding_boxes, flow_analysis)
    logger.info(f"Teardown report generated at: {report_path}")

if __name__ == "__main__":
    # You can alternatively run: asyncio.run(run_full_scrape("https://example.com"))
    main()