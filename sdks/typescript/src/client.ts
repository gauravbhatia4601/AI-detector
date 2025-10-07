import { InspectRequest, InspectResponse, ReportResponse } from './types.js';

export interface OrchestratorClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
}

export class OrchestratorClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: OrchestratorClientOptions) {
    if (!options.baseUrl) {
      throw new Error('baseUrl is required');
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultHeaders = options.headers ?? {};
  }

  async inspect(payload: InspectRequest): Promise<InspectResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/inspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await this.readErrorBody(response);
      throw new Error(`Inspect request failed with ${response.status}: ${body}`);
    }

    return (await response.json()) as InspectResponse;
  }

  async getReport(assetId: string): Promise<ReportResponse> {
    if (!assetId) {
      throw new Error('assetId is required');
    }

    const response = await this.fetchImpl(`${this.baseUrl}/report/${encodeURIComponent(assetId)}`, {
      method: 'GET',
      headers: this.defaultHeaders,
    });

    if (response.status === 404) {
      throw new Error('Report not found');
    }

    if (!response.ok) {
      const body = await this.readErrorBody(response);
      throw new Error(`Report request failed with ${response.status}: ${body}`);
    }

    return (await response.json()) as ReportResponse;
  }

  private async readErrorBody(response: Response): Promise<string> {
    try {
      const text = await response.text();
      return text || '<empty>';
    } catch (err) {
      return `<failed to read error body: ${String(err)}>`;
    }
  }
}

export * from './types.js';
