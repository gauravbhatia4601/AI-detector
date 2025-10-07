# Infrastructure and Local Orchestration

This directory contains helper assets for running the full detector stack with
Docker Compose. The compose file launches every microservice plus Postgres and
MinIO so the orchestrator can exercise persistence and storage flows locally.

## Prerequisites

- Docker and Docker Compose v2
- The repository cloned locally

## Usage

```bash
cd infra
cp ../services/orchestrator/.env.example .env # optional overrides
docker compose up --build
```

The default configuration exposes the services on the following ports:

| Service | Port |
| --- | --- |
| provenance-rs | 8080 |
| watermark-synthid | 8081 |
| detector-sensity | 8082 |
| detector-hive | 8083 |
| detector-readef | 8084 |
| orchestrator | 8085 (mapped to container port 8080) |
| MinIO API / Console | 9000 / 9001 |
| Postgres | 5432 |

MinIO is initialised with credentials `orchestrator` / `orchestrator123`. A
bucket named `orchestrator` will be lazily created by the orchestrator service
when the first asset is uploaded.

To tear down the environment run:

```bash
docker compose down -v
```

The video pipeline container is included to demonstrate how sampling jobs would
be run in the same network. It does not expose any ports by default.
