export type DetectorMediaModality = 'image' | 'video' | 'audio';

export type DetectorVerdict = 'watermark_detected' | 'not_detected' | 'inconclusive';

export interface EvidenceSegment {
  startTimeMs?: number;
  endTimeMs?: number;
  verdict: DetectorVerdict;
  confidence?: number | null;
  notes?: string[];
}

export interface DetectorEvidence {
  modality: DetectorMediaModality;
  verdict: DetectorVerdict;
  confidence: number | null;
  notes: string[];
  segments: EvidenceSegment[];
  raw: unknown;
}

export interface DetectorResponse {
  detector: 'synthid';
  requestId: string;
  evidence: DetectorEvidence;
}

export interface DetectorErrorResponse {
  error: string;
  status?: number;
}

export type DetectorApiResponse = DetectorResponse | DetectorErrorResponse;
