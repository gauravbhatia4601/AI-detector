export interface AuditRecord {
  assetId: string;
  verdict: "approved" | "flagged" | "reject" | "unknown";
  confidence: number;
  evidence: {
    provenance?: unknown;
    watermark?: unknown;
    detectors: unknown[];
  };
  metadata?: Record<string, unknown>;
  storedAt: Date;
  storageLocation?: string;
}

export interface AuditRepository {
  save(record: AuditRecord): Promise<void>;
  find(assetId: string): Promise<AuditRecord | undefined>;
}
