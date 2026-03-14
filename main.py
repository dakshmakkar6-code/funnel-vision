import asyncio
import json
from pathlib import Path

from scraper import scrape_page
from scraper import collect_text_and_button_boxes


# async def main() -> None:
# 	url = "https://katerubybradshaw.com/coaching"
	
# 	scrape_result = await scrape_page(url)
# 	box_result = await collect_text_and_button_boxes(url)
# 	payload = {
# 		"scrape_page": scrape_result,
# 		"collect_text_and_button_boxes": box_result,
# 	}
# 	output_path = Path("scrape_results.json")
# 	output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
# 	print(f"Saved scrape results to {output_path}")


# if __name__ == "__main__":
# 	asyncio.run(main())

from report_generator import generate_teardown_report


def main() -> None:
    scrape_results = json.loads(Path("scrape_results.json").read_text(encoding="utf-8"))
    scrape_page_result = scrape_results.get("scrape_page", {})
    box_result = scrape_results.get("collect_text_and_button_boxes", {})

    image_paths = scrape_page_result.get("screenshot_paths") or []
    if not image_paths:
        fallback_image = scrape_page_result.get("screenshot_path")
        if fallback_image:
            image_paths = [fallback_image]
    if not image_paths:
        fallback_images = sorted(Path("page_screenshots").glob("*.png"))
        image_paths = [str(path) for path in fallback_images]
    if not image_paths:
        raise FileNotFoundError("No screenshot found. Run scrape_page first to generate page screenshots.")

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
        if all(k in box for k in ("x", "y", "width", "height"))
    ]

    flow_analysis = {
        "Friction": "The headline is clear but the call-to-action button is not prominent.",
        "Legitimacy": "The page looks professional and trustworthy.",
        "Offer Clarity": "The offer is somewhat clear but could be more specific.",
        "Willingness to Buy": "Users may be hesitant due to lack of urgency or incentives."
    }
    report_path = generate_teardown_report(image_paths, bounding_boxes, flow_analysis)
    print(f"Teardown report generated at: {report_path}")

if __name__ == "__main__":
    main()