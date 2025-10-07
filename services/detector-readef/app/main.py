from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile

from .config import Settings
from .models import AnalyzeResponse, HealthResponse
from .service import DetectorError, RealityDefenderDetector

logger = logging.getLogger(__name__)


@lru_cache()
def get_settings() -> Settings:
    return Settings.from_env()


@lru_cache()
def get_detector() -> RealityDefenderDetector:
    return RealityDefenderDetector(get_settings())


app = FastAPI(title="Reality Defender Detector", version="0.1.0")


@app.on_event("shutdown")
async def shutdown_detector() -> None:
    await get_detector().aclose()


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(...),
    detector: RealityDefenderDetector = Depends(get_detector),
) -> AnalyzeResponse:
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="empty upload")
    try:
        return await detector.analyze(payload, file.content_type)
    except DetectorError as err:
        logger.exception("Reality Defender analysis failed")
        raise HTTPException(status_code=502, detail=str(err)) from err
