import asyncio
import json
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from report_generator import generate_teardown_report
from scraper import collect_text_and_button_boxes, scrape_page

load_dotenv()

app = FastAPI(title="FunnelVision API", version="0.1.0")

# ---------------------------------------------------------------------------
# CORS — allow the Next.js dev server (and any other origin during development)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated reports as static files
REPORTS_DIR = Path("generated_reports")
REPORTS_DIR.mkdir(exist_ok=True)
app.mount("/reports", StaticFiles(directory=str(REPORTS_DIR)), name="reports")

SCREENSHOTS_DIR = Path("page_screenshots")
SCREENSHOTS_DIR.mkdir(exist_ok=True)
app.mount("/screenshots", StaticFiles(directory=str(SCREENSHOTS_DIR)), name="screenshots")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    url: str


class ReportRequest(BaseModel):
    scrape_results: dict
    flow_analysis: dict | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    """Simple health-check endpoint."""
    return {"status": "ok"}


@app.get("/api/results")
async def get_existing_results():
    """Return the cached scrape_results.json if it exists."""
    results_path = Path("scrape_results.json")
    if not results_path.exists():
        raise HTTPException(status_code=404, detail="No cached results found. Run a scrape first.")
    data = json.loads(results_path.read_text(encoding="utf-8"))
    return data


@app.post("/api/scrape")
async def scrape(request: ScrapeRequest):
    """
    Scrape a URL and return structured data + screenshot paths.
    Saves results to scrape_results.json for caching.
    """
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=422, detail="URL must not be empty.")

    try:
        scrape_result, box_result = await asyncio.gather(
            scrape_page(url),
            collect_text_and_button_boxes(url),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scrape failed: {exc}") from exc

    payload = {
        "scrape_page": scrape_result,
        "collect_text_and_button_boxes": box_result,
    }
    Path("scrape_results.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return payload


@app.post("/api/report")
async def report(request: ReportRequest, background_tasks: BackgroundTasks):
    """
    Generate a teardown PDF from scrape results.
    Returns a URL to download the generated report.
    """
    scrape_page_result = request.scrape_results.get("scrape_page", {})
    box_result = request.scrape_results.get("collect_text_and_button_boxes", {})

    # Gather screenshot paths
    image_paths: list[str] = scrape_page_result.get("screenshot_paths") or []
    if not image_paths:
        fallback = scrape_page_result.get("screenshot_path")
        if fallback:
            image_paths = [fallback]
    if not image_paths:
        fallback_images = sorted(SCREENSHOTS_DIR.glob("*.png"))
        image_paths = [str(p) for p in fallback_images]
    if not image_paths:
        raise HTTPException(
            status_code=400,
            detail="No screenshots found. Run /api/scrape first.",
        )

    # Gather bounding boxes
    text_boxes = box_result.get("text_boxes", [])
    button_boxes = box_result.get("button_boxes", [])
    raw_boxes = [*text_boxes, *button_boxes]
    bounding_boxes = [
        {
            "x": b.get("x"),
            "y": b.get("y"),
            "width": b.get("width"),
            "height": b.get("height"),
        }
        for b in raw_boxes
        if all(k in b for k in ("x", "y", "width", "height"))
    ]

    flow_analysis = request.flow_analysis or {
        "Friction": "The headline is clear but the call-to-action button is not prominent.",
        "Legitimacy": "The page looks professional and trustworthy.",
        "Offer Clarity": "The offer is somewhat clear but could be more specific.",
        "Willingness to Buy": "Users may be hesitant due to lack of urgency or incentives.",
    }

    report_filename = f"teardown_report_{uuid.uuid4().hex[:8]}.pdf"  # type: ignore
    report_path = str(REPORTS_DIR / report_filename)

    try:
        generate_teardown_report(image_paths, bounding_boxes, flow_analysis)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}") from exc

    # Move from the default output path into the reports directory
    default_output = Path("teardown_report.pdf")
    if default_output.exists():
        default_output.rename(report_path)

    return {
        "report_url": f"/reports/{report_filename}",
        "filename": report_filename,
    }


@app.get("/api/report/{filename}")
async def download_report(filename: str):
    """Download a previously generated PDF report."""
    report_path = REPORTS_DIR / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found.")
    return FileResponse(
        path=str(report_path),
        media_type="application/pdf",
        filename=filename,
    )
