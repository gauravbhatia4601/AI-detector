import pathlib
import sys

import pytest
import pytest_asyncio
import respx
from httpx import ASGITransport, AsyncClient, Response

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import Settings
from app.main import app, get_detector
from app.service import RealityDefenderDetector


@pytest.fixture(autouse=True)
def clear_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def detector():
    instance = RealityDefenderDetector(
        Settings(
            api_key="test",
            base_url="https://api.realitydefender.com/v1",
            timeout=5.0,
            max_retries=2,
            failure_threshold=2,
            recovery_seconds=60.0,
            backoff_factor=0.0,
        )
    )
    yield instance
    await instance.aclose()


@pytest_asyncio.fixture
async def client(detector: RealityDefenderDetector):
    app.dependency_overrides[get_detector] = lambda: detector
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client


@pytest.mark.asyncio
@respx.mock
async def test_analyze_success(client: AsyncClient):
    payload = {"result": {"label": "real", "score": 0.1, "reasons": ["lighting"], "model_version": "rd-1"}}
    route = respx.post("https://api.realitydefender.com/v1/deepfake").mock(
        return_value=Response(200, json=payload)
    )

    response = await client.post(
        "/analyze",
        files={"file": ("asset.mp4", b"payload", "video/mp4")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "label": "real",
        "score": 0.1,
        "reasons": ["lighting"],
        "modelVersion": "rd-1",
    }
    assert route.called


@pytest.mark.asyncio
@respx.mock
async def test_circuit_breaker_opens(client: AsyncClient):
    route = respx.post("https://api.realitydefender.com/v1/deepfake").mock(
        return_value=Response(504, json={"error": "timeout"})
    )

    first = await client.post(
        "/analyze",
        files={"file": ("asset.mp4", b"payload", "video/mp4")},
    )
    second = await client.post(
        "/analyze",
        files={"file": ("asset.mp4", b"payload", "video/mp4")},
    )
    third = await client.post(
        "/analyze",
        files={"file": ("asset.mp4", b"payload", "video/mp4")},
    )

    assert first.status_code == 502
    assert second.status_code == 502
    assert third.status_code == 502
    assert "circuit breaker" in third.json()["detail"]
    assert route.call_count == 2
