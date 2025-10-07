export interface DetectorResponse {
  label: string;
  score: number;
  reasons: string[];
  modelVersion: string;
}

export interface FrameSample {
  buffer: Buffer;
  contentType: string;
  frameId: string;
}

export interface AnalyzeRequest {
  modality: "image" | "video";
  sample: Buffer;
  contentType: string;
  frames?: FrameSample[];
}
