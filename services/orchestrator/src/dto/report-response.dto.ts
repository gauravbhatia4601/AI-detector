import type { AuditRecord } from "../repository/audit.repository.js";

export class ReportResponseDto {
  assetId!: string;
  verdict!: AuditRecord["verdict"];
  confidence!: number;
  evidence!: AuditRecord["evidence"];
  metadata?: AuditRecord["metadata"];
  storedAt!: string;
  storageLocation?: string;
}
