"""Smoke test ensuring CDN delivery settings preserve C2PA manifests."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import tomllib

FIXTURES = Path(__file__).parent / "fixtures"
CONFIG = Path(__file__).resolve().parents[2] / "infra" / "cdn" / "cloudflare-images.toml"


def load_asset(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


@dataclass
class CloudflareImagesPolicy:
    preserve_content_credentials: bool
    strip_metadata: bool

    @classmethod
    def from_file(cls, path: Path) -> "CloudflareImagesPolicy":
        data = tomllib.loads(path.read_text())
        delivery = data.get("delivery", {})
        return cls(
            preserve_content_credentials=delivery.get("content_credentials") == "preserve",
            strip_metadata=bool(delivery.get("strip_metadata", False)),
        )


class FakeCloudflareImages:
    """Minimal in-memory CDN that honours preservation directives."""

    def __init__(self, policy: CloudflareImagesPolicy) -> None:
        if not policy.preserve_content_credentials or policy.strip_metadata:
            raise ValueError("CDN policy does not preserve Content Credentials")
        self._objects: dict[str, bytes] = {}
        self._next_id = 0

    def upload(self, payload: bytes) -> str:
        identifier = f"asset-{self._next_id}"
        self._next_id += 1
        self._objects[identifier] = payload
        return identifier

    def download(self, identifier: str) -> bytes:
        return self._objects[identifier]


def has_c2pa_manifest(payload: bytes) -> bool:
    return b"VALID_C2PA" in payload


def test_cloudflare_images_preserves_c2pa_round_trip() -> None:
    policy = CloudflareImagesPolicy.from_file(CONFIG)
    cdn = FakeCloudflareImages(policy)

    original = load_asset("valid_image.bin")
    assert has_c2pa_manifest(original), "fixture must include provenance marker"

    asset_id = cdn.upload(original)
    restored = cdn.download(asset_id)

    assert restored == original, "CDN should not mutate bytes when preservation enabled"
    assert has_c2pa_manifest(restored), "C2PA marker should survive CDN delivery"
