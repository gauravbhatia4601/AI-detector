"""Minimal Python SDK for the orchestrator service."""
from __future__ import annotations

from typing import Any, Dict, Literal, Optional, TypedDict, cast

import httpx


Verdict = Literal["approved", "flagged", "reject", "unknown"]


class Evidence(TypedDict, total=False):
    source: str
    kind: str
    score: Optional[float]
    details: Dict[str, Any]


class InspectRequest(TypedDict, total=False):
    assetId: str
    mediaType: Literal["image", "video", "audio"]
    sourceUrl: Optional[str]
    provenance: Dict[str, Any]
    watermark: Dict[str, Any]


class InspectResponse(TypedDict):
    assetId: str
    verdict: Verdict
    confidence: float
    evidence: list[Evidence]


class ReportResponse(InspectResponse, total=False):
    createdAt: str
    policyVersion: Optional[str]


class OrchestratorClient:
    """HTTP client for orchestrator operations."""

    def __init__(
        self,
        base_url: str,
        *,
        client: Optional[httpx.Client] = None,
        timeout: float = 10.0,
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        self._base_url = base_url.rstrip("/")
        if client is None:
            self._client = httpx.Client(base_url=self._base_url, timeout=timeout, headers=headers)
            self._owns_client = True
        else:
            self._client = client
            self._owns_client = False

    @property
    def base_url(self) -> str:
        return self._base_url

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def inspect(self, payload: InspectRequest) -> InspectResponse:
        response = self._client.post("/inspect", json=payload)
        response.raise_for_status()
        return cast(InspectResponse, response.json())

    def get_report(self, asset_id: str) -> ReportResponse:
        if not asset_id:
            raise ValueError("asset_id is required")
        response = self._client.get(f"/report/{asset_id}")
        if response.status_code == 404:
            raise KeyError("Report not found")
        response.raise_for_status()
        return cast(ReportResponse, response.json())

    def __enter__(self) -> "OrchestratorClient":  # pragma: no cover - simple delegation
        return self

    def __exit__(self, *exc: object) -> None:  # pragma: no cover - simple delegation
        self.close()
