import type { Verdict } from "../types.js";

export class InspectResponseDto {
  assetId!: string;
  verdict!: Verdict["verdict"];
  confidence!: number;
  evidence!: Verdict["evidence"];
  storedAt!: string;
  storageLocation?: string;
}
