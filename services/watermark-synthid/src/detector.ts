import type { SynthIdEvidence, SynthIdRequest } from "./schema.js";

const KEYWORDS = ["synthid", "watermark", "google", "deepmind"];

export function normalizeEvidence(input: SynthIdRequest): SynthIdEvidence {
  const textPayload = typeof input.detectorSignal === "string"
    ? input.detectorSignal.toLowerCase()
    : JSON.stringify(input.detectorSignal).toLowerCase();

  const present = KEYWORDS.some((keyword) => textPayload.includes(keyword));
  const confidence = present ? deriveConfidence(textPayload) : 0;

  const notes = new Set<string>();
  if (present) {
    notes.add("SynthID watermark detected");
  } else {
    notes.add("No SynthID watermark signature detected");
  }

  return {
    present,
    confidence,
    modality: input.modality,
    notes: Array.from(notes),
  };
}

function deriveConfidence(signal: string): number {
  if (signal.includes("high")) {
    return 0.95;
  }
  if (signal.includes("medium")) {
    return 0.7;
  }
  if (signal.includes("low")) {
    return 0.4;
  }
  return 0.6;
}
