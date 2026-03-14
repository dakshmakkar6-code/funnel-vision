"""Validate shape of scrape results from scraper_web."""
import asyncio
import pytest
import sys
from pathlib import Path

# Allow importing scraper_web from parent
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scraper_web import scrape


@pytest.mark.asyncio
async def test_scrape_returns_expected_structure():
    """Scrape a simple page and assert result has required keys and box shape."""
    result = await asyncio.wait_for(
        scrape("https://example.com"),
        timeout=25.0,
    )
    assert isinstance(result, dict)
    assert "screenshotUrl" in result
    assert "boxes" in result
    assert "pageHeight" in result
    assert "pageWidth" in result
    assert isinstance(result["boxes"], list)
    assert result["pageHeight"] >= 0
    assert result["pageWidth"] >= 0
    assert result["screenshotUrl"].startswith("/screenshots/")

    # If we got any boxes, validate first one
    if result["boxes"]:
        box = result["boxes"][0]
        assert "type" in box
        assert "tagName" in box
        assert "x" in box and "y" in box
        assert "width" in box and "height" in box
        assert box["type"] in (
            "text",
            "button",
            "image",
            "input",
            "background-image",
            "container",
        )
