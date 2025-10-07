export interface ProvenanceEvidence {
  assetId: string;
  valid: boolean;
  issuer?: string;
  errors?: string[];
}

export interface WatermarkEvidence {
  present: boolean;
  confidence: number;
  modality: "image" | "video" | "audio";
  notes: string[];
}

export interface DetectorEvidence {
  label: string;
  score: number;
  reasons: string[];
  modelVersion: string;
}

export interface InspectionInput {
  provenance?: ProvenanceEvidence;
  watermark?: WatermarkEvidence;
  detectors?: DetectorEvidence[];
}

export interface Verdict {
  verdict: "approved" | "flagged" | "reject" | "unknown";
  confidence: number;
  evidence: {
    provenance?: ProvenanceEvidence;
    watermark?: WatermarkEvidence;
    detectors: DetectorEvidence[];
  };
}
