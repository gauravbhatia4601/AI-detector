from __future__ import annotations

import respx
from httpx import Response

from ai_detector_sdk import OrchestratorClient


@respx.mock
def test_inspect_success() -> None:
    route = respx.post("https://example.test/inspect").mock(
        return_value=Response(
            200,
            json={
                "assetId": "asset-123",
                "verdict": "approved",
                "confidence": 0.9,
                "evidence": [],
            },
        )
    )

    client = OrchestratorClient("https://example.test")
    result = client.inspect({"assetId": "asset-123", "mediaType": "image"})

    assert route.called
    assert result["verdict"] == "approved"

    client.close()


@respx.mock
def test_get_report_not_found() -> None:
    respx.get("https://example.test/report/missing").mock(return_value=Response(404))

    client = OrchestratorClient("https://example.test")
    try:
        client.get_report("missing")
    except KeyError:
        pass
    else:
        raise AssertionError("expected KeyError when report missing")
    finally:
        client.close()
