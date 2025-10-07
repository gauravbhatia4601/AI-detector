from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any

import httpx

from .circuit import CircuitBreaker, CircuitOpenError
from .config import Settings
from .models import AnalyzeResponse

logger = logging.getLogger(__name__)


class DetectorError(RuntimeError):
    pass


class RealityDefenderDetector:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(
            base_url=settings.base_url,
            headers={"X-API-Key": settings.api_key},
            timeout=settings.timeout,
        )
        self._breaker = CircuitBreaker(
            failure_threshold=settings.failure_threshold,
            recovery_seconds=settings.recovery_seconds,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def analyze(self, payload: bytes, content_type: str | None) -> AnalyzeResponse:
        if not payload:
            raise DetectorError("empty payload")

        body = {
            "content": base64.b64encode(payload).decode("ascii"),
            "contentType": content_type or "application/octet-stream",
        }

        last_error: Exception | None = None
        for attempt in range(1, self._settings.max_retries + 1):
            try:
                await self._breaker.allow()
            except CircuitOpenError as err:
                raise DetectorError(str(err)) from err

            try:
                response = await self._client.post("/deepfake", json=body)
                if response.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        "server error", request=response.request, response=response
                    )
                response.raise_for_status()
                result = self._normalize(response.json())
                await self._breaker.record_success()
                return result
            except (httpx.TimeoutException, httpx.HTTPStatusError) as err:
                last_error = err
                logger.warning("reality defender request failed", exc_info=err)
                await self._breaker.record_failure()
                if attempt == self._settings.max_retries:
                    break
                await asyncio.sleep(self._settings.backoff_factor * attempt)
            except httpx.RequestError as err:
                raise DetectorError(f"network error contacting Reality Defender: {err}") from err

        if last_error:
            raise DetectorError(f"Reality Defender request failed: {last_error}") from last_error
        raise DetectorError("Reality Defender request failed")

    def _normalize(self, payload: dict[str, Any]) -> AnalyzeResponse:
        result = payload.get("result") or payload
        label = result.get("label") or result.get("verdict") or "unknown"
        score = float(result.get("score") or result.get("confidence") or 0.0)
        reasons = result.get("reasons") or result.get("notes") or []
        model_version = result.get("modelVersion") or result.get("model_version") or "unknown"
        return AnalyzeResponse(label=label, score=score, reasons=reasons, modelVersion=model_version)


async def create_detector(settings: Settings | None = None) -> RealityDefenderDetector:
    return RealityDefenderDetector(settings or Settings.from_env())
