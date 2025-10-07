import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AppConfig, Modality } from "../config.js";
import type { DetectorEvidence } from "../types.js";
import { APP_CONFIG } from "../tokens.js";

interface AnalyzeOptions {
  assetId: string;
  buffer: Buffer;
  contentType: string;
  modality: Modality;
}

@Injectable()
export class PassiveDetectorClient {
  private readonly logger = new Logger(PassiveDetectorClient.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async runDetectors(options: AnalyzeOptions): Promise<DetectorEvidence[]> {
    const tasks: Array<Promise<DetectorEvidence>> = [];
    const { endpoints } = this.config;

    if (endpoints.sensityUrl) {
      const base = endpoints.sensityUrl.replace(/\/$/, "");
      tasks.push(this.callFormDetector(`${base}/analyze`, options, "file"));
    }
    if (endpoints.hiveUrl) {
      const field = options.modality === "video" ? "frames" : "file";
      const base = endpoints.hiveUrl.replace(/\/$/, "");
      tasks.push(this.callFormDetector(`${base}/analyze`, options, field, options.modality));
    }
    if (endpoints.realityDefenderUrl) {
      const base = endpoints.realityDefenderUrl.replace(/\/$/, "");
      tasks.push(this.callFormDetector(`${base}/analyze`, options, "file"));
    }

    if (tasks.length === 0) {
      this.logger.warn("No passive detectors configured");
      return [];
    }

    const settled = await Promise.allSettled(tasks);
    return settled.flatMap((result) => {
      if (result.status === "fulfilled") {
        return [result.value];
      }
      this.logger.error(`Detector call failed: ${result.reason}`);
      return [];
    });
  }

  private async callFormDetector(
    url: string,
    options: AnalyzeOptions,
    fieldName: string,
    modalityOverride?: Modality,
  ): Promise<DetectorEvidence> {
    const normalizedUrl = url.replace(/\/$/, "");
    const form = new FormData();
    const blobPart = options.buffer as unknown as BlobPart;
    form.append(fieldName, new Blob([blobPart], { type: options.contentType }), `${options.assetId}`);
    form.append("modality", modalityOverride ?? options.modality);
    form.append("assetId", options.assetId);
    const response = await fetch(normalizedUrl, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Detector request failed: ${response.status} ${text}`);
    }
    const body = await response.json();
    return body as DetectorEvidence;
  }
}
