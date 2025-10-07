import { describe, expect, it } from "vitest";
import { fuseSignals } from "../src/policy.js";

describe("fuseSignals", () => {
  it("approves valid provenance", () => {
    const verdict = fuseSignals({
      provenance: {
        assetId: "asset-1",
        valid: true,
        issuer: "Trusted Authority",
      },
      detectors: [],
    });

    expect(verdict.verdict).toBe("approved");
    expect(verdict.confidence).toBeCloseTo(0.9);
  });

  it("flags watermark hits", () => {
    const verdict = fuseSignals({
      provenance: {
        assetId: "asset-2",
        valid: false,
        errors: ["missing"],
      },
      watermark: {
        present: true,
        confidence: 0.8,
        modality: "image",
        notes: ["detected"],
      },
      detectors: [],
    });

    expect(verdict.verdict).toBe("flagged");
    expect(verdict.confidence).toBe(0.8);
  });

  it("rejects high detector score", () => {
    const verdict = fuseSignals({
      detectors: [
        {
          label: "deepfake",
          score: 0.95,
          reasons: ["model"],
          modelVersion: "1",
        },
      ],
    });

    expect(verdict.verdict).toBe("reject");
    expect(verdict.confidence).toBeCloseTo(0.95);
  });
});
