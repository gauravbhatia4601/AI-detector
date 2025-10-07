import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable, Logger } from "@nestjs/common";

import type { ObjectStorageConfig } from "../config.js";
import type { StorageService, StoredAsset } from "./storage.service.js";

@Injectable()
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly logger = new Logger(S3StorageService.name);

  constructor(private readonly config: ObjectStorageConfig) {
    if (!config.bucket) {
      throw new Error("S3 bucket must be configured");
    }

    this.client = new S3Client({
      region: config.region ?? "us-east-1",
      endpoint: config.endpoint,
      forcePathStyle: Boolean(config.endpoint),
      credentials: config.accessKeyId && config.secretAccessKey
        ? {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        }
        : undefined,
    });
  }

  async store(assetId: string, buffer: Buffer, contentType: string): Promise<StoredAsset> {
    const key = this.buildKey(assetId);
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    this.logger.log(`Stored asset ${assetId} in bucket ${this.config.bucket}`);
    return {
      assetId,
      contentType,
      size: buffer.length,
      location: `s3://${this.config.bucket}/${key}`,
    };
  }

  private buildKey(assetId: string): string {
    const prefix = this.config.prefix ? `${this.config.prefix.replace(/\/$/, "")}/` : "";
    return `${prefix}${assetId}`;
  }
}
