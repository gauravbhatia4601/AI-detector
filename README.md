# AI Detector Monorepo

This repository contains a lightweight reference implementation for orchestrating
multiple trust and deepfake detection services. It now ships detector stubs for
every vendor integration described in the project brief so the policy engine can
be exercised end-to-end during development:

- **provenance-rs** – Rust microservice that accepts a JSON payload, performs a
  deterministic manifest lookup, and stores the latest manifest evidence in
  memory. The implementation is intentionally simple but demonstrates how a
  provenance verification service can expose `/verify`, `/manifest/:assetId`,
  and `/health` endpoints.
- **watermark-synthid** – TypeScript service that normalizes SynthID style
  outputs into a consistent evidence schema. Unit tests cover detection of
  watermark keywords and absence cases.
- **detector-sensity** – FastAPI service that wraps the Sensity deepfake API.
  It handles rate limits with exponential backoff, caches responses by content
  hash, and normalizes results into the shared evidence schema.
- **detector-hive** – Express-based service that talks to Hive's Deepfake API
  or the NVIDIA NIM proxy. It aggregates scores across sampled frames and
  exposes a consistent `/analyze` endpoint.
- **detector-readef** – FastAPI service integrating Reality Defender with a
  simple circuit breaker for resilience and consistent JSON responses.
- **orchestrator** – NestJS service that persists inspection jobs, stores
  original media in object storage, orchestrates provenance + watermark +
  detector calls, and exposes `/inspect`, `/report/:assetId`, and `/health`
  endpoints. Unit tests exercise end-to-end verdict logic and audit retention.
- **video-pipeline** – TypeScript job runner that simulates AWS MediaConvert
  transcoding, verifies resulting assets against the provenance service, and
  generates deterministic sampling plans for downstream detectors.

## Project layout

```
services/
  provenance-rs/         # Axum-based HTTP server with in-memory manifest cache
  watermark-synthid/     # Express server exposing POST /check
  detector-sensity/      # FastAPI client for Sensity with caching + retries
  detector-hive/         # Express service calling Hive or NVIDIA NIM APIs
  detector-readef/       # FastAPI Reality Defender client with circuit breaker
  orchestrator/          # NestJS orchestrator service with policy + storage
  video-pipeline/        # MediaConvert job runner with deterministic sampling
sdks/
  typescript/            # TypeScript client for orchestrator endpoints
  python/                # Python client for orchestrator endpoints
openapi/                 # Hand-authored OpenAPI specs for each HTTP service
postman/                 # Ready-to-import Postman collection
```

Each service includes minimal unit tests so the repository can be validated via
`cargo test`, `pytest`, or `npm test` depending on the runtime. A repository
level `Makefile` is provided to run individual suites or execute the entire
stack with `make e2e`.

## Getting started

1. **Rust provenance service**

   ```bash
   cd services/provenance-rs
   cargo test
   cargo run # optional, starts the HTTP server on port 8080
   ```

2. **SynthID watermark service**

   ```bash
   cd services/watermark-synthid
   npm install
   npm test
   npm start # optional, starts the HTTP server on port 8081
   ```

3. **Sensity detector service**

   ```bash
   cd services/detector-sensity
   pip install fastapi uvicorn[standard] httpx pydantic cachetools python-multipart pytest pytest-asyncio respx
   pytest
   ```

4. **Hive detector service**

   ```bash
   cd services/detector-hive
   npm install
   npm test
   ```

5. **Reality Defender detector**

   ```bash
   cd services/detector-readef
   pip install fastapi uvicorn[standard] httpx pydantic python-multipart pytest pytest-asyncio respx
   pytest
   ```

6. **Orchestrator API**

   ```bash
   cd services/orchestrator
   npm install
   npm test
   # optional: start the NestJS HTTP server
   PROVENANCE_URL=http://localhost:8080 \ 
   SYNTHID_URL=http://localhost:8081 \ 
   SENSITY_URL=http://localhost:8082 \ 
   HIVE_URL=http://localhost:8083 \ 
   REALITY_DEFENDER_URL=http://localhost:8084 \ 
   node --loader ts-node/esm src/main.ts
   ```

7. **Video pipeline job**

   The pipeline uses stubbed MediaConvert and provenance clients so the
   sampling and verification logic can be tested without AWS credentials.

 ```bash
  cd services/video-pipeline
  npm install
  npm test
  # optional: run with PIPELINE_JOB env var when providing real clients
  ```

8. **All services together (Docker Compose)**

   ```bash
   cd infra
   docker compose up --build
   ```

   The compose bundle launches Postgres and MinIO alongside the microservices so
   the orchestrator can exercise persistence and storage locally. Copy any of the
   `*.env.example` files into `.env` files to override defaults during local
   testing.

9. **SDKs and API schemas**

   - TypeScript client: `cd sdks/typescript && npm install && npm test`
   - Python client: `cd sdks/python && pip install -e .[test] && pytest`
   - OpenAPI specs live in `openapi/` and can be imported into your preferred tooling.
   - Postman collection: `postman/ai-detector.postman_collection.json`.

10. **CDN preservation smoke test**

    ```bash
    cd tests/preservation
    pytest
    ```

    The smoke test exercises the sample Cloudflare Images configuration in
    `infra/cdn/cloudflare-images.toml` to ensure Content Credentials survive an
    upload/download round trip.

### Orchestrator configuration

Environment variables allow you to point the orchestrator at running detector
services and optional infrastructure:

| Variable | Purpose |
| --- | --- |
| `PROVENANCE_URL` | Base URL for the provenance verification service |
| `SYNTHID_URL` | Base URL for the SynthID watermark normalizer |
| `SENSITY_URL` | Base URL for the Sensity detector |
| `HIVE_URL` | Base URL for the Hive detector |
| `REALITY_DEFENDER_URL` | Base URL for the Reality Defender detector |
| `DATABASE_URL` | Postgres connection string for audit persistence |
| `OBJECT_BUCKET` | Bucket name for S3-compatible object storage |
| `OBJECT_REGION` | Optional S3 region |
| `OBJECT_ENDPOINT` | Optional S3-compatible endpoint override |
| `OBJECT_ACCESS_KEY_ID` / `OBJECT_SECRET_ACCESS_KEY` | Credentials for S3 storage |
| `OBJECT_PREFIX` | Optional prefix for stored asset keys |

When no `DATABASE_URL` is provided the service falls back to an in-memory audit
repository for local development. Likewise, omitting the S3 configuration keeps
asset data in process memory so the API remains self-contained.

## Notes

- The services use deterministic fixtures in place of real vendor API calls.
  This keeps the repository self-contained while illustrating data contracts.
- Trusted issuer handling, SynthID parsing, and detector aggregation are kept
  intentionally small to simplify comprehension. They can be expanded to call
  production-grade services as needed.
- Package managers generate lock files (`Cargo.lock` and `package-lock.json`) so
  builds are reproducible.

## License

This project is licensed under the [MIT License](LICENSE).
