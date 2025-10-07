import { HiveClient } from "./hiveClient.js";
import type { DetectorResponse, FrameSample } from "./types.js";

export class DetectorError extends Error {}

export class HiveDetectorService {
  constructor(private readonly client: HiveClient) {}

  async analyzeImage(buffer: Buffer, contentType: string): Promise<DetectorResponse> {
    try {
      return await this.client.analyzeImage(buffer, contentType);
    } catch (error) {
      throw new DetectorError((error as Error).message);
    }
  }

  async analyzeVideo(frames: FrameSample[]): Promise<DetectorResponse> {
    try {
      return await this.client.analyzeVideo(frames);
    } catch (error) {
      throw new DetectorError((error as Error).message);
    }
  }
}
