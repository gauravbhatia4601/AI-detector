from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(slots=True)
class Settings:
    api_key: str
    base_url: str
    timeout: float
    max_retries: int
    cache_ttl_seconds: int
    cache_max_entries: int
    backoff_factor: float

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            api_key=os.getenv("SENSITY_API_KEY", "test-key"),
            base_url=os.getenv("SENSITY_BASE_URL", "https://api.sensity.ai/v2"),
            timeout=float(os.getenv("SENSITY_TIMEOUT", "10")),
            max_retries=int(os.getenv("SENSITY_MAX_RETRIES", "3")),
            cache_ttl_seconds=int(os.getenv("SENSITY_CACHE_TTL", "600")),
            cache_max_entries=int(os.getenv("SENSITY_CACHE_SIZE", "256")),
            backoff_factor=float(os.getenv("SENSITY_BACKOFF", "0.5")),
        )
