import "reflect-metadata";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";

import { AppModule } from "../src/app.module.js";
import type { AppConfig } from "../src/config.js";
import type { AuditRepository } from "../src/repository/audit.repository.js";
import { InMemoryAuditRepository } from "../src/repository/memory.repository.js";
import { InMemoryStorageService } from "../src/storage/memory.storage.js";
import type { DetectorEvidence, ProvenanceEvidence, WatermarkEvidence } from "../src/types.js";
import { APP_CONFIG, AUDIT_REPOSITORY, STORAGE_SERVICE } from "../src/tokens.js";
import { ProvenanceClient } from "../src/clients/provenance.client.js";
import { SynthIdClient } from "../src/clients/synthid.client.js";
import { PassiveDetectorClient } from "../src/clients/detectors.client.js";
import { InspectionService } from "../src/services/inspection.service.js";
import { InspectController } from "../src/controllers/inspect.controller.js";

class FakeAuditRepository extends InMemoryAuditRepository {}

describe("Orchestrator API", () => {
  let app: INestApplication;
  const provenanceVerify = vi.fn<[], Promise<ProvenanceEvidence | undefined>>();
  const synthCheck = vi.fn<[], Promise<WatermarkEvidence | undefined>>();
  const detectorRun = vi.fn<[], Promise<DetectorEvidence[]>>();
  let repository: AuditRepository;
  let storage: InMemoryStorageService;

  beforeEach(async () => {
    const config: AppConfig = {
      port: 0,
      endpoints: {},
      database: {},
      objectStorage: {},
      defaultModality: "image",
    };

    storage = new InMemoryStorageService();
    repository = new FakeAuditRepository();

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(ProvenanceClient)
      .useValue({ verify: provenanceVerify })
      .overrideProvider(SynthIdClient)
      .useValue({ check: synthCheck })
      .overrideProvider(PassiveDetectorClient)
      .useValue({ runDetectors: detectorRun })
      .overrideProvider(InspectionService)
      .useClass(InspectionService)
      .overrideProvider(STORAGE_SERVICE)
      .useValue(storage)
      .overrideProvider(AUDIT_REPOSITORY)
      .useValue(repository)
      .compile();

    app = module.createNestApplication();
    await app.init();
    const service = app.get(InspectionService);
    expect(service).toBeDefined();
    const controller = app.get(InspectController);
    expect((controller as any).inspectionService).toBeDefined();
  });

  afterEach(async () => {
    vi.resetAllMocks();
    if (app) {
      await app.close();
    }
  });

  it("returns approved verdict when provenance is valid", async () => {
    provenanceVerify.mockResolvedValue({
      assetId: "asset-1",
      valid: true,
      issuer: "Trusted Authority",
    });
    synthCheck.mockResolvedValue({
      present: false,
      confidence: 0,
      modality: "image",
      notes: ["No SynthID watermark signature detected"],
    });
    detectorRun.mockResolvedValue([
      { label: "clean", score: 0.2, reasons: [], modelVersion: "1.0" },
    ]);

    const assetPayload = Buffer.from("VALID_C2PA").toString("base64");

    const response = await request(app.getHttpServer())
      .post("/inspect")
      .send({
        assetId: "asset-1",
        base64: assetPayload,
        contentType: "text/plain",
      })
      .expect(200);

    expect(response.body.verdict).toBe("approved");
    expect(response.body.confidence).toBeGreaterThan(0.8);
    expect(storage.get("asset-1")).toBeDefined();

    const report = await request(app.getHttpServer())
      .get("/report/asset-1")
      .expect(200);

    expect(report.body.verdict).toBe("approved");
    await expect(repository.find("asset-1")).resolves.toBeDefined();
  });

  it("flags when detectors return high scores", async () => {
    provenanceVerify.mockResolvedValue({
      assetId: "asset-2",
      valid: false,
      errors: ["missing metadata"],
    });
    synthCheck.mockResolvedValue({
      present: true,
      confidence: 0.9,
      modality: "image",
      notes: ["SynthID watermark detected"],
    });
    detectorRun.mockResolvedValue([
      { label: "deepfake", score: 0.95, reasons: ["face swap"], modelVersion: "2.0" },
    ]);

    const payload = Buffer.from("SUSPECT").toString("base64");

    const response = await request(app.getHttpServer())
      .post("/inspect")
      .send({
        assetId: "asset-2",
        base64: payload,
        contentType: "text/plain",
      })
      .expect(200);

    expect(response.body.verdict).toBe("reject");
    expect(response.body.evidence.detectors).toHaveLength(1);
    expect(response.body.evidence.provenance.valid).toBe(false);
  });

  it("returns 404 when report missing", async () => {
    await request(app.getHttpServer()).get("/report/missing").expect(404);
  });
});
