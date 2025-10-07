# Python Orchestrator SDK

The `ai-detector-sdk` package offers a small wrapper around the orchestrator
service. It relies on `httpx` and provides simple helpers for submitting
inspection requests and fetching audit reports.

## Usage

```python
from ai_detector_sdk import OrchestratorClient

client = OrchestratorClient("http://localhost:8090")
result = client.inspect({"assetId": "demo", "mediaType": "image"})
print(result["verdict"])
client.close()
```
