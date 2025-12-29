from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .calculator import calculate
from .schemas import CalcIn


app = FastAPI(title="Opsiyon Hesaplama")

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/manifest.webmanifest")
def manifest():
    resp = FileResponse(
        path=str(BASE_DIR / "static" / "manifest.webmanifest"),
        media_type="application/manifest+json",
    )
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/sw.js")
def service_worker():
    resp = FileResponse(
        path=str(BASE_DIR / "static" / "sw.js"),
        media_type="application/javascript",
    )
    resp.headers["Service-Worker-Allowed"] = "/"
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.post("/api/calc")
def api_calc(payload: CalcIn):
    return calculate(payload)
