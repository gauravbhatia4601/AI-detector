import fetch from "node-fetch";
import { z } from "zod";

import { Settings } from "./config.js";
import type { DetectorResponse, FrameSample } from "./types.js";

const singleResponseSchema = z.object({
  label: z.string(),
  score: z.number(),
  reasons: z.array(z.string()).optional(),
  modelVersion: z.string().optional(),
});

const batchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        label: z.string(),
        score: z.number(),
        reasons: z.array(z.string()).optional(),
        modelVersion: z.string().optional(),
        frameId: z.string().optional(),
      }),
    )
    .min(1),
});

export class HiveClient {
  constructor(private readonly settings: Settings) {}

  async analyzeImage(sample: Buffer, contentType: string): Promise<DetectorResponse> {
    const json = await this.post("deepfake", {
      content: sample.toString("base64"),
      contentType,
    });
    const parsed = singleResponseSchema.parse(json.result ?? json);
    return {
      label: parsed.label,
      score: parsed.score,
      reasons: parsed.reasons ?? [],
      modelVersion: parsed.modelVersion ?? "unknown",
    };
  }

  async analyzeVideo(frames: FrameSample[]): Promise<DetectorResponse> {
    if (frames.length === 0) {
      throw new Error("no frames provided");
    }
    const json = await this.post("deepfake/batch", {
      frames: frames.map((frame) => ({
        frameId: frame.frameId,
        content: frame.buffer.toString("base64"),
        contentType: frame.contentType,
      })),
    });
    const parsed = batchResponseSchema.parse(json);
    const top = parsed.results.reduce((acc, item) => {
      if (!acc || item.score > acc.score) {
        return item;
      }
      return acc;
    });
    const reasons = new Set<string>();
    for (const entry of parsed.results) {
      for (const reason of entry.reasons ?? []) {
        reasons.add(reason);
      }
      if (entry.frameId) {
        reasons.add(`frame:${entry.frameId}`);
      }
    }
    return {
      label: top.label,
      score: Number(top.score.toFixed(3)),
      reasons: Array.from(reasons),
      modelVersion: top.modelVersion ?? "unknown",
    };
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const base = this.settings.baseUrl.endsWith("/")
      ? this.settings.baseUrl
      : `${this.settings.baseUrl}/`;
    const url = new URL(path, base).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${this.settings.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Hive API error: ${response.status} ${text}`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Hive request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
