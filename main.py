import asyncio
import json
from pathlib import Path

from scraper import scrape_page
from scraper import collect_text_and_button_boxes


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

