from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
from typing import Any

import httpx
from cachetools import TTLCache

from .config import Settings
from .models import AnalyzeResponse

logger = logging.getLogger(__name__)


class DetectorError(RuntimeError):
    """Raised when the detector cannot fulfil the request."""


class SensityDetector:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._cache: TTLCache[str, AnalyzeResponse] = TTLCache(
            maxsize=settings.cache_max_entries,
            ttl=settings.cache_ttl_seconds,
        )
        self._cache_lock = asyncio.Lock()
        self._client = httpx.AsyncClient(
            base_url=settings.base_url,
            headers={"Authorization": f"Bearer {settings.api_key}"},
            timeout=settings.timeout,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def analyze(self, payload: bytes, content_type: str | None) -> AnalyzeResponse:
        if not payload:
            raise DetectorError("empty payload")

        digest = hashlib.sha256(payload).hexdigest()
        cached = await self._get_from_cache(digest)
        if cached is not None:
            return cached

        response = await self._dispatch(payload, content_type or "application/octet-stream")
        await self._store_in_cache(digest, response)
        return response

    async def _dispatch(self, payload: bytes, content_type: str) -> AnalyzeResponse:
        body = {
            "content": base64.b64encode(payload).decode("ascii"),
            "contentType": content_type,
        }
        last_error: Exception | None = None
        for attempt in range(1, self._settings.max_retries + 1):
            try:
                logger.debug("posting to sensity", extra={"attempt": attempt})
                res = await self._client.post("/deepfake-detection", json=body)
                if res.status_code == 429:
                    delay = self._settings.backoff_factor * attempt
                    logger.warning(
                        "sensity rate limit, backing off", extra={"attempt": attempt, "delay": delay}
                    )
                    await asyncio.sleep(delay)
                    continue
                res.raise_for_status()
                payload = res.json()
                return self._normalize(payload)
            except (httpx.TimeoutException, httpx.HTTPStatusError) as err:
                last_error = err
                delay = self._settings.backoff_factor * attempt
                logger.error(
                    "sensity request failed", exc_info=err, extra={"attempt": attempt, "delay": delay}
                )
                if attempt == self._settings.max_retries:
                    break
                await asyncio.sleep(delay)
            except httpx.RequestError as err:
                raise DetectorError(f"network error contacting Sensity: {err}") from err
        if last_error:
            raise DetectorError(f"Sensity request failed: {last_error}") from last_error
        raise DetectorError("Sensity request failed")

    def _normalize(self, payload: dict[str, Any]) -> AnalyzeResponse:
        result = payload.get("result") or payload
        label = result.get("label") or result.get("verdict") or "unknown"
        score = float(result.get("score") or result.get("confidence") or 0.0)
        reasons = result.get("reasons") or result.get("explanations") or []
        model_version = (
            result.get("modelVersion")
            or result.get("model_version")
            or result.get("model")
            or "unknown"
        )
        return AnalyzeResponse(label=label, score=score, reasons=reasons, modelVersion=model_version)

    async def _get_from_cache(self, digest: str) -> AnalyzeResponse | None:
        async with self._cache_lock:
            return self._cache.get(digest)

    async def _store_in_cache(self, digest: str, response: AnalyzeResponse) -> None:
        async with self._cache_lock:
            self._cache[digest] = response


async def create_detector(settings: Settings | None = None) -> SensityDetector:
    return SensityDetector(settings or Settings.from_env())
