from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(slots=True)
class Settings:
    api_key: str
    base_url: str
    timeout: float
    max_retries: int
    failure_threshold: int
    recovery_seconds: float
    backoff_factor: float

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            api_key=os.getenv("READEF_API_KEY", "test-key"),
            base_url=os.getenv("READEF_BASE_URL", "https://api.realitydefender.com/v1"),
            timeout=float(os.getenv("READEF_TIMEOUT", "10")),
            max_retries=int(os.getenv("READEF_MAX_RETRIES", "3")),
            failure_threshold=int(os.getenv("READEF_FAILURE_THRESHOLD", "3")),
            recovery_seconds=float(os.getenv("READEF_RECOVERY_SECONDS", "30")),
            backoff_factor=float(os.getenv("READEF_BACKOFF", "0.5")),
        )
