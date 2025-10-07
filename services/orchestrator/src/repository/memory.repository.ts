import { Injectable } from "@nestjs/common";

import type { AuditRecord, AuditRepository } from "./audit.repository.js";

@Injectable()
export class InMemoryAuditRepository implements AuditRepository {
  private readonly store = new Map<string, AuditRecord>();

  async save(record: AuditRecord): Promise<void> {
    this.store.set(record.assetId, { ...record });
  }

  async find(assetId: string): Promise<AuditRecord | undefined> {
    const value = this.store.get(assetId);
    return value ? { ...value, storedAt: new Date(value.storedAt) } : undefined;
  }
}
