import { Injectable } from "@nestjs/common";

import type { StorageService, StoredAsset } from "./storage.service.js";

@Injectable()
export class InMemoryStorageService implements StorageService {
  private readonly records = new Map<string, StoredAsset & { data: Buffer }>();

  async store(assetId: string, buffer: Buffer, contentType: string): Promise<StoredAsset> {
    const record: StoredAsset & { data: Buffer } = {
      assetId,
      contentType,
      size: buffer.length,
      data: Buffer.from(buffer),
      location: `memory://${assetId}`,
    };
    this.records.set(assetId, record);
    return record;
  }

  get(assetId: string): (StoredAsset & { data: Buffer }) | undefined {
    return this.records.get(assetId);
  }
}
