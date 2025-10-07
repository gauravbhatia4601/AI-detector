import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";

import type { AuditRecord, AuditRepository } from "./audit.repository.js";

@Injectable()
export class PostgresAuditRepository implements AuditRepository, OnModuleDestroy {
  private readonly logger = new Logger(PostgresAuditRepository.name);
  private readonly pool: Pool;
  private initialized = false;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        asset_id TEXT PRIMARY KEY,
        verdict TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        evidence JSONB NOT NULL,
        metadata JSONB,
        stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        storage_location TEXT
      )
    `);
    this.initialized = true;
    this.logger.log("Postgres audit repository ready");
  }

  async save(record: AuditRecord): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    await this.pool.query(
      `INSERT INTO inspections (asset_id, verdict, confidence, evidence, metadata, stored_at, storage_location)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
       ON CONFLICT (asset_id) DO UPDATE SET
         verdict = EXCLUDED.verdict,
         confidence = EXCLUDED.confidence,
         evidence = EXCLUDED.evidence,
         metadata = EXCLUDED.metadata,
         stored_at = EXCLUDED.stored_at,
         storage_location = EXCLUDED.storage_location`,
      [
        record.assetId,
        record.verdict,
        record.confidence,
        JSON.stringify(record.evidence),
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.storedAt,
        record.storageLocation ?? null,
      ],
    );
  }

  async find(assetId: string): Promise<AuditRecord | undefined> {
    if (!this.initialized) {
      await this.init();
    }
    const result = await this.pool.query(
      `SELECT asset_id, verdict, confidence, evidence, metadata, stored_at, storage_location
       FROM inspections
       WHERE asset_id = $1`,
      [assetId],
    );
    if (result.rowCount === 0) {
      return undefined;
    }
    const row = result.rows[0];
    return {
      assetId: row.asset_id,
      verdict: row.verdict,
      confidence: Number(row.confidence),
      evidence: row.evidence,
      metadata: row.metadata ?? undefined,
      storedAt: row.stored_at,
      storageLocation: row.storage_location ?? undefined,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
