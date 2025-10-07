import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AppConfig } from "../config.js";
import type { ProvenanceEvidence } from "../types.js";
import { APP_CONFIG } from "../tokens.js";

interface VerifyPayload {
  asset_id: string;
  base64?: string;
  url?: string;
}

interface VerifyResponse {
  assetId: string;
  valid: boolean;
  issuer?: string;
  errors?: string[];
}

@Injectable()
export class ProvenanceClient {
  private readonly logger = new Logger(ProvenanceClient.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async verify(payload: VerifyPayload): Promise<ProvenanceEvidence | undefined> {
    const endpoint = this.config.endpoints.provenanceUrl;
    if (!endpoint) {
      this.logger.warn("Provenance endpoint not configured; skipping verification");
      return undefined;
    }
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asset_id: payload.asset_id,
        assetId: payload.asset_id,
        base64: payload.base64,
        url: payload.url,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Provenance verification failed: ${response.status} ${text}`);
    }
    const body = (await response.json()) as VerifyResponse;
    return {
      assetId: body.assetId,
      valid: body.valid,
      issuer: body.issuer,
      errors: body.errors,
    };
  }
}
