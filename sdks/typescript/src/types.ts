export type Verdict = 'approved' | 'flagged' | 'reject' | 'unknown';

export interface Evidence {
  source: string;
  kind: string;
  score?: number | null;
  details: Record<string, unknown>;
}

export interface InspectRequest {
  assetId: string;
  mediaType: 'image' | 'video' | 'audio';
  sourceUrl?: string;
  provenance?: Record<string, unknown>;
  watermark?: Record<string, unknown>;
}

export interface InspectResponse {
  assetId: string;
  verdict: Verdict;
  confidence: number;
  evidence: Evidence[];
}

export interface ReportResponse extends InspectResponse {
  createdAt: string;
  policyVersion?: string;
}
