from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile

from .config import Settings
from .models import AnalyzeResponse, HealthResponse
from .service import DetectorError, SensityDetector

logger = logging.getLogger(__name__)


@lru_cache()
def get_settings() -> Settings:
    return Settings.from_env()


@lru_cache()
def get_detector() -> SensityDetector:
    return SensityDetector(get_settings())


app = FastAPI(title="Sensity Detector", version="0.1.0")


@app.on_event("shutdown")
async def shutdown_detector() -> None:
    detector = get_detector()
    await detector.aclose()


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(...),
    detector: SensityDetector = Depends(get_detector),
) -> AnalyzeResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty upload")
    try:
        return await detector.analyze(content, file.content_type)
    except DetectorError as err:
        logger.exception("Sensity analyze failed")
        raise HTTPException(status_code=502, detail=str(err)) from err
