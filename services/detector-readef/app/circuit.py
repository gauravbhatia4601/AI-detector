from __future__ import annotations

import asyncio
import time


class CircuitOpenError(RuntimeError):
    """Raised when the circuit breaker is open."""


class CircuitBreaker:
    def __init__(self, failure_threshold: int, recovery_seconds: float) -> None:
        self._failure_threshold = failure_threshold
        self._recovery_seconds = recovery_seconds
        self._state = "closed"
        self._failure_count = 0
        self._opened_at = 0.0
        self._lock = asyncio.Lock()

    async def allow(self) -> None:
        async with self._lock:
            if self._state == "open":
                if time.monotonic() - self._opened_at >= self._recovery_seconds:
                    self._state = "half-open"
                else:
                    raise CircuitOpenError("circuit breaker is open")

    async def record_success(self) -> None:
        async with self._lock:
            self._failure_count = 0
            self._state = "closed"

    async def record_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            if self._failure_count >= self._failure_threshold:
                self._state = "open"
                self._opened_at = time.monotonic()

    async def half_open(self) -> bool:
        async with self._lock:
            return self._state == "half-open"
