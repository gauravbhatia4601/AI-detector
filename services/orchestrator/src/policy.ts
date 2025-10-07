import type { DetectorEvidence, InspectionInput, Verdict } from "./types.js";

const REJECT_THRESHOLD = 0.9;
const FLAG_THRESHOLD = 0.6;

export function fuseSignals(input: InspectionInput): Verdict {
  const detectors = input.detectors ?? [];
  const provenance = input.provenance;
  const watermark = input.watermark;

  if (provenance?.valid) {
    return buildVerdict("approved", 0.9, provenance, watermark, detectors);
  }

  const maxDetector = detectors.reduce<DetectorEvidence | undefined>((acc, current) => {
    if (!acc || current.score > acc.score) {
      return current;
    }
    return acc;
  }, undefined);

  if (maxDetector && maxDetector.score >= REJECT_THRESHOLD) {
    return buildVerdict("reject", maxDetector.score, provenance, watermark, detectors);
  }

  if ((watermark?.present && watermark.confidence >= FLAG_THRESHOLD)
      || (maxDetector && maxDetector.score >= FLAG_THRESHOLD)
      || (provenance && !provenance.valid)) {
    const confidence = Math.max(
      watermark?.confidence ?? 0,
      maxDetector?.score ?? 0.5,
    );
    return buildVerdict("flagged", confidence, provenance, watermark, detectors);
  }

  return buildVerdict("unknown", 0.5, provenance, watermark, detectors);
}

function buildVerdict(
  verdict: Verdict["verdict"],
  confidence: number,
  provenance: InspectionInput["provenance"],
  watermark: InspectionInput["watermark"],
  detectors: DetectorEvidence[],
): Verdict {
  return {
    verdict,
    confidence: Number(confidence.toFixed(2)),
    evidence: {
      provenance,
      watermark,
      detectors,
    },
  };
}
