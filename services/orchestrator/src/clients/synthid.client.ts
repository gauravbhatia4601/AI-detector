import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AppConfig, Modality } from "../config.js";
import type { WatermarkEvidence } from "../types.js";
import { APP_CONFIG } from "../tokens.js";

interface CheckRequest {
  assetId: string;
  modality: Modality;
  detectorSignal: unknown;
}

@Injectable()
export class SynthIdClient {
  private readonly logger = new Logger(SynthIdClient.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async check(request: CheckRequest): Promise<WatermarkEvidence | undefined> {
    const endpoint = this.config.endpoints.synthIdUrl;
    if (!endpoint) {
      this.logger.warn("SynthID endpoint not configured; skipping watermark check");
      return undefined;
    }
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SynthID check failed: ${response.status} ${text}`);
    }
    return (await response.json()) as WatermarkEvidence;
  }
}
