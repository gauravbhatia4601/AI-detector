export type Modality = "image" | "video" | "audio";

export interface ServiceEndpoints {
  provenanceUrl?: string;
  synthIdUrl?: string;
  sensityUrl?: string;
  hiveUrl?: string;
  realityDefenderUrl?: string;
}

export interface DatabaseConfig {
  url?: string;
}

export interface ObjectStorageConfig {
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix?: string;
}

export interface AppConfig {
  port: number;
  endpoints: ServiceEndpoints;
  database: DatabaseConfig;
  objectStorage: ObjectStorageConfig;
  defaultModality: Modality;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? "8080"),
    endpoints: {
      provenanceUrl: process.env.PROVENANCE_URL,
      synthIdUrl: process.env.SYNTHID_URL,
      sensityUrl: process.env.SENSITY_URL,
      hiveUrl: process.env.HIVE_URL,
      realityDefenderUrl: process.env.REALITY_DEFENDER_URL,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    objectStorage: {
      bucket: process.env.OBJECT_BUCKET,
      region: process.env.OBJECT_REGION,
      endpoint: process.env.OBJECT_ENDPOINT,
      accessKeyId: process.env.OBJECT_ACCESS_KEY_ID,
      secretAccessKey: process.env.OBJECT_SECRET_ACCESS_KEY,
      prefix: process.env.OBJECT_PREFIX,
    },
    defaultModality: (process.env.DEFAULT_MODALITY as Modality) ?? "image",
  };
}
