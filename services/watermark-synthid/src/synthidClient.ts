import type { DetectorMediaModality } from '../../../src/schema';

export type SynthIDVerdict = 'WATERMARK_PRESENT' | 'WATERMARK_ABSENT' | 'INCONCLUSIVE';

export interface SynthIDSegmentResult {
  startTimeMs?: number;
  endTimeMs?: number;
  verdict: SynthIDVerdict;
  confidence?: number | null;
  explanation?: string;
}

export interface SynthIDDetectionResponse {
  requestId: string;
  modality: 'IMAGE' | 'VIDEO' | 'AUDIO';
  overall: {
    verdict: SynthIDVerdict;
    confidence: number | null;
    explanation?: string;
  };
  segments?: SynthIDSegmentResult[];
  metadata?: Record<string, unknown>;
}

export interface SynthIDClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface DetectionOptions {
  url?: string;
  file?: Buffer;
  fileName?: string;
  mimeType?: string;
}

export class SynthIDClientError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SynthIDClientError';
    this.status = status;
  }
}

export class SynthIDClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: SynthIDClientOptions) {
    if (!options.apiKey) {
      throw new Error('SynthIDClient requires an apiKey');
    }

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://synthid.googleapis.com';
    this.fetchFn = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async detectImage(options: DetectionOptions): Promise<SynthIDDetectionResponse> {
    return this.detect('image', options);
  }

  async detectVideo(options: DetectionOptions): Promise<SynthIDDetectionResponse> {
    return this.detect('video', options);
  }

  async detectAudio(options: DetectionOptions): Promise<SynthIDDetectionResponse> {
    return this.detect('audio', options);
  }

  private async detect(modality: DetectorMediaModality, options: DetectionOptions): Promise<SynthIDDetectionResponse> {
    if (!options.file && !options.url) {
      throw new SynthIDClientError('A file or url must be provided for detection');
    }

    const form = new FormData();

    if (options.file) {
      const view = new Uint8Array(options.file);
      const blob = new Blob([view], {
        type: options.mimeType ?? 'application/octet-stream'
      });
      form.append('file', blob, options.fileName ?? 'upload');
    }

    if (options.url) {
      form.append('url', options.url);
    }

    form.append('modality', modality);

    const response = await this.fetchFn(`${this.baseUrl}/v1/detect/${modality}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: form
    });

    if (!response.ok) {
      const message = `SynthID detection failed with status ${response.status}`;
      throw new SynthIDClientError(message, response.status);
    }

    const json = (await response.json()) as SynthIDDetectionResponse;
    return json;
  }
}
