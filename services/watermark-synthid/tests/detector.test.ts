import { describe, expect, it } from "vitest";
import { normalizeEvidence } from "../src/detector.js";

describe("normalizeEvidence", () => {
  it("detects synthid keywords", () => {
    const evidence = normalizeEvidence({
      assetId: "asset-1",
      modality: "image",
      detectorSignal: "SynthID watermark high",
    });

    expect(evidence.present).toBe(true);
    expect(evidence.confidence).toBeGreaterThan(0.9);
    expect(evidence.notes).toContain("SynthID watermark detected");
  });

  it("handles absence", () => {
    const evidence = normalizeEvidence({
      assetId: "asset-2",
      modality: "video",
      detectorSignal: "random noise",
    });

    expect(evidence.present).toBe(false);
    expect(evidence.confidence).toBe(0);
    expect(evidence.notes).toContain("No SynthID watermark signature detected");
  });
});
