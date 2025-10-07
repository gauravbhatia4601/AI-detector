# TypeScript Orchestrator SDK

A minimal client for interacting with the orchestrator service from Node.js or
browser applications. It wraps the `/inspect` and `/report/:assetId` endpoints
and exposes TypeScript definitions for verdict and evidence payloads.

## Usage

```ts
import { OrchestratorClient } from '@ai-detector/orchestrator-client';

const client = new OrchestratorClient({ baseUrl: 'http://localhost:8090' });
const response = await client.inspect({ assetId: 'demo', mediaType: 'image' });
console.log(response.verdict);
```
