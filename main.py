import asyncio
import json
import sys
from pathlib import Path

# Add python_scraper directory to path so local modules resolve
PYTHON_SCRAPER_DIR = Path(__file__).resolve().parent / "python_scraper"
if str(PYTHON_SCRAPER_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_SCRAPER_DIR))

from scraper import scrape_page  # type: ignore[import-not-found]
from scraper import collect_text_and_button_boxes  # type: ignore[import-not-found]


async def main() -> None:
	url = "https://www.paidtobringpeace.com/blueprints"
	
	scrape_result = await scrape_page(url)
	box_result = await collect_text_and_button_boxes(url)
	payload = {
		"scrape_page": scrape_result,
		"collect_text_and_button_boxes": box_result,
	}
	output_path = Path("scrape_results.json")
	output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
	print(f"Saved scrape results to {output_path}")


if __name__ == "__main__":
	asyncio.run(main())
