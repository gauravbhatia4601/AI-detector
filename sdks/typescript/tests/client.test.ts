import { describe, expect, it, vi } from 'vitest';
import { OrchestratorClient } from '../src/client.js';

const createFetch = (handlers: Record<string, () => Promise<Response>>) => {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.toString()}`;
    const handler = handlers[key];
    if (!handler) {
      throw new Error(`No handler for ${key}`);
    }
    return handler();
  });
};

describe('OrchestratorClient', () => {
  it('posts inspect payloads and returns JSON', async () => {
    const fetchMock = createFetch({
      'POST https://example.test/inspect': async () =>
        new Response(
          JSON.stringify({
            assetId: 'asset-123',
            verdict: 'approved',
            confidence: 0.95,
            evidence: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    const client = new OrchestratorClient({ baseUrl: 'https://example.test', fetchImpl: fetchMock });
    const result = await client.inspect({ assetId: 'asset-123', mediaType: 'image' });

    expect(result.verdict).toBe('approved');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/inspect', expect.any(Object));
  });

  it('throws on non-200 inspect responses', async () => {
    const fetchMock = createFetch({
      'POST https://example.test/inspect': async () =>
        new Response('invalid', {
          status: 500,
        }),
    });

    const client = new OrchestratorClient({ baseUrl: 'https://example.test', fetchImpl: fetchMock });
    await expect(client.inspect({ assetId: 'a', mediaType: 'image' })).rejects.toThrow(
      /Inspect request failed/,
    );
  });

  it('retrieves reports', async () => {
    const fetchMock = createFetch({
      'GET https://example.test/report/asset-123': async () =>
        new Response(
          JSON.stringify({
            assetId: 'asset-123',
            verdict: 'flagged',
            confidence: 0.4,
            evidence: [],
            createdAt: '2024-01-01T00:00:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    const client = new OrchestratorClient({ baseUrl: 'https://example.test', fetchImpl: fetchMock });
    const report = await client.getReport('asset-123');

    expect(report.verdict).toBe('flagged');
    expect(report.createdAt).toContain('2024');
  });

  it('throws if report missing', async () => {
    const fetchMock = createFetch({
      'GET https://example.test/report/missing': async () => new Response('', { status: 404 }),
    });

    const client = new OrchestratorClient({ baseUrl: 'https://example.test', fetchImpl: fetchMock });
    await expect(client.getReport('missing')).rejects.toThrow(/Report not found/);
  });
});
