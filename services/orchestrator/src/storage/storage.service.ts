export interface StoredAsset {
  assetId: string;
  contentType: string;
  size: number;
  location?: string;
}

export interface StorageService {
  store(assetId: string, buffer: Buffer, contentType: string): Promise<StoredAsset>;
}
