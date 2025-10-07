from __future__ import annotations

from pydantic import BaseModel, Field


class AnalyzeResponse(BaseModel):
    label: str = Field(...)
    score: float = Field(..., ge=0, le=1)
    reasons: list[str] = Field(default_factory=list)
    modelVersion: str = Field(...)


class HealthResponse(BaseModel):
    status: str = "ok"
