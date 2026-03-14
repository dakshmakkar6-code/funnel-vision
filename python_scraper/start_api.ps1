# Start the FunnelVision FastAPI backend (runs inside the uv-managed .venv)
# Run from the python_scraper directory

Set-Location $PSScriptRoot
uv run uvicorn api:app --reload --host 0.0.0.0 --port 8000
