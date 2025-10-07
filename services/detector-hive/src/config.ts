export type BackendMode = "default" | "nim";

export interface Settings {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  backend: BackendMode;
}

export function loadSettings(): Settings {
  const backend = (process.env.HIVE_BACKEND ?? "default") as BackendMode;
  const defaultUrl = "https://api.thehive.ai/api/v2";
  const nimUrl = process.env.HIVE_NIM_BASE_URL ?? "https://integrations.nvidia.com/v1/hive";
  return {
    apiKey: process.env.HIVE_API_KEY ?? "test-key",
    baseUrl: backend === "nim" ? nimUrl : process.env.HIVE_BASE_URL ?? defaultUrl,
    timeoutMs: Number(process.env.HIVE_TIMEOUT_MS ?? "10000"),
    backend,
  };
}
