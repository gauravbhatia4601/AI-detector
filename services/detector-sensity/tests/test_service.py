import pathlib
import sys

import pytest
import pytest_asyncio
import respx
from httpx import ASGITransport, AsyncClient, Response

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import Settings
from app.main import app, get_detector
from app.service import SensityDetector


@pytest.fixture(autouse=True)
def clear_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def detector():
    instance = SensityDetector(
        Settings(
            api_key="test",
            base_url="https://api.sensity.ai/v2",
            timeout=5.0,
            max_retries=3,
            cache_ttl_seconds=60,
            cache_max_entries=16,
            backoff_factor=0.0,
        )
    )
    yield instance
    await instance.aclose()


@pytest_asyncio.fixture
async def client(detector: SensityDetector):
    app.dependency_overrides[get_detector] = lambda: detector
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client


@pytest.mark.asyncio
@respx.mock
async def test_analyze_success(client: AsyncClient):
    payload = {"result": {"label": "real", "score": 0.2, "reasons": ["eyes"], "model_version": "v1"}}
    route = respx.post("https://api.sensity.ai/v2/deepfake-detection").mock(
        return_value=Response(200, json=payload)
    )

    response = await client.post(
        "/analyze",
        files={"file": ("sample.jpg", b"sample-bytes", "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data == {
        "label": "real",
        "score": 0.2,
        "reasons": ["eyes"],
        "modelVersion": "v1",
    }
    assert route.called


@pytest.mark.asyncio
@respx.mock
async def test_analyze_cached(client: AsyncClient):
    payload = {"result": {"label": "fake", "score": 0.9, "reasons": [], "model_version": "v2"}}
    route = respx.post("https://api.sensity.ai/v2/deepfake-detection").mock(
        return_value=Response(200, json=payload)
    )

    body = {"file": ("sample.jpg", b"another", "image/jpeg")}
    first = await client.post("/analyze", files=body)
    second = await client.post("/analyze", files=body)

    assert first.status_code == 200
    assert second.status_code == 200
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_retries_on_rate_limit(client: AsyncClient):
    payload = {"result": {"label": "fake", "score": 0.8, "reasons": ["mouth"], "model_version": "v3"}}
    route = respx.post("https://api.sensity.ai/v2/deepfake-detection").mock(
        side_effect=[Response(429, json={"error": "rate"}), Response(200, json=payload)]
    )

    response = await client.post(
        "/analyze",
        files={"file": ("clip.mp4", b"video-bytes", "video/mp4")},
    )

    assert response.status_code == 200
    assert route.call_count == 2
