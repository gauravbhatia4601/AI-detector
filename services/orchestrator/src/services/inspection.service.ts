import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AppConfig, Modality } from "../config.js";
import type { StoredAsset } from "../storage/storage.service.js";
import type { AuditRecord, AuditRepository } from "../repository/audit.repository.js";
import type { StorageService } from "../storage/storage.service.js";
import type { InspectionInput } from "../types.js";
import { fuseSignals } from "../policy.js";
import type { DetectorEvidence, ProvenanceEvidence, WatermarkEvidence } from "../types.js";
import type { InspectRequestDto } from "../dto/inspect-request.dto.js";
import type { InspectResponseDto } from "../dto/inspect-response.dto.js";
import { APP_CONFIG, AUDIT_REPOSITORY, STORAGE_SERVICE } from "../tokens.js";
import { PassiveDetectorClient } from "../clients/detectors.client.js";
import { ProvenanceClient } from "../clients/provenance.client.js";
import { SynthIdClient } from "../clients/synthid.client.js";

@Injectable()
export class InspectionService {
  private readonly logger = new Logger(InspectionService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(AUDIT_REPOSITORY) private readonly repository: AuditRepository,
    @Inject(ProvenanceClient) private readonly provenanceClient: ProvenanceClient,
    @Inject(SynthIdClient) private readonly synthIdClient: SynthIdClient,
    @Inject(PassiveDetectorClient) private readonly detectorClient: PassiveDetectorClient,
  ) {}

  async inspect(request: InspectRequestDto): Promise<InspectResponseDto> {
    const assetBuffer = request.base64 ? Buffer.from(request.base64, "base64") : undefined;
    const contentType = request.contentType ?? "application/octet-stream";
    const modality = request.modality ?? this.config.defaultModality;

    const stored: StoredAsset | undefined = assetBuffer
      ? await this.storage.store(request.assetId, assetBuffer, contentType)
      : undefined;

    const [provenance, watermark, detectors] = await Promise.all([
      this.runProvenanceCheck(request),
      this.runWatermarkCheck(request, modality),
      this.runPassiveDetectors(request, assetBuffer, contentType, modality),
    ]);

    const verdict = fuseSignals({
      provenance: provenance ?? undefined,
      watermark: watermark ?? undefined,
      detectors,
    } satisfies InspectionInput);

    const record: AuditRecord = {
      assetId: request.assetId,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      evidence: verdict.evidence,
      metadata: request.metadata,
      storedAt: new Date(),
      storageLocation: stored?.location,
    };
    await this.repository.save(record);

    return {
      assetId: request.assetId,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      evidence: verdict.evidence,
      storedAt: record.storedAt.toISOString(),
      storageLocation: stored?.location,
    };
  }

  async getReport(assetId: string): Promise<AuditRecord | undefined> {
    return this.repository.find(assetId);
  }

  private async runProvenanceCheck(
    request: InspectRequestDto,
  ): Promise<ProvenanceEvidence | null> {
    if (!request.base64 && !request.url) {
      return null;
    }
    try {
      return (await this.provenanceClient.verify({
        asset_id: request.assetId,
        base64: request.base64,
        url: request.url,
      })) ?? null;
    } catch (error) {
      this.logger.error(`Provenance check failed for ${request.assetId}: ${(error as Error).message}`);
      return {
        assetId: request.assetId,
        valid: false,
        errors: [(error as Error).message],
      };
    }
  }

  private async runWatermarkCheck(
    request: InspectRequestDto,
    modality: Modality,
  ): Promise<WatermarkEvidence | null> {
    if (!request.watermarkSignal && !request.base64) {
      return null;
    }
    const signal = request.watermarkSignal ?? request.base64 ?? request.assetId;
    try {
      return (await this.synthIdClient.check({
        assetId: request.assetId,
        modality,
        detectorSignal: signal,
      })) ?? null;
    } catch (error) {
      this.logger.error(`SynthID check failed: ${(error as Error).message}`);
      return null;
    }
  }

  private async runPassiveDetectors(
    request: InspectRequestDto,
    assetBuffer: Buffer | undefined,
    contentType: string,
    modality: Modality,
  ): Promise<DetectorEvidence[]> {
    if (!assetBuffer) {
      return [];
    }
    try {
      return await this.detectorClient.runDetectors({
        assetId: request.assetId,
        buffer: assetBuffer,
        contentType,
        modality,
      });
    } catch (error) {
      this.logger.error(`Passive detector run failed: ${(error as Error).message}`);
      return [];
    }
  }
}
