from __future__ import annotations

from pydantic import BaseModel, Field


class AnalyzeResponse(BaseModel):
    label: str = Field(..., description="Detector label for the asset")
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0 and 1")
    reasons: list[str] = Field(default_factory=list, description="Model explanations")
    modelVersion: str = Field(..., description="Model version reported by Sensity")


class HealthResponse(BaseModel):
    status: str = "ok"
