from __future__ import annotations

from typing import Any, Iterable

from scraper_web import scrape


async def scrape_funnel(urls: Iterable[str]) -> dict[str, Any]:
    """Scrape a multi-step funnel made of several URLs.

    Returns a structure that can be mapped to FunnelScrapeResult on the frontend:
    {
        "steps": [
            {
                "stepIndex": 0,
                "url": "...",
                "screenshotUrl": "...",
                "pageHeight": ...,
                "pageWidth": ...,
                "elements": [...boxes from scraper_web...],
            },
            ...
        ]
    }
    """
    steps = []
    for index, url in enumerate(urls):
        result = await scrape(url)
        steps.append(
            {
                "stepIndex": index,
                "url": url,
                "screenshotUrl": result.get("screenshotUrl"),
                "pageHeight": result.get("pageHeight"),
                "pageWidth": result.get("pageWidth"),
                # Existing scraper returns `boxes`; the frontend will normalize into elements.
                "elements": result.get("boxes", []),
            }
        )

    return {"steps": steps}

