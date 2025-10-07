import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SynthIDClient } from '../services/watermark-synthid/src/synthidClient';
import { normalizeSynthIDResponse } from '../src/detector';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture<T>(fileName: string): T {
  const filePath = path.join(fixturesDir, fileName);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

describe('SynthID client normalization', () => {
  const baseUrl = 'https://synthid.test';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it('normalizes image detections from SynthID', async () => {
    const rawResponse = loadFixture<Record<string, unknown>>('synthid-image.json');
    const expected = loadFixture<Record<string, unknown>>('synthid-image.normalized.json');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(rawResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const client = new SynthIDClient({ apiKey: 'test-key', baseUrl, fetchImpl: fetchMock as unknown as typeof fetch });
    const detection = await client.detectImage({ url: 'https://example.com/image.png' });
    const normalized = normalizeSynthIDResponse(detection);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${baseUrl}/v1/detect/image`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get('modality')).toBe('image');
    expect(body.get('url')).toBe('https://example.com/image.png');

    expect(normalized).toEqual(expected);
  });

  it('normalizes video detections with segment detail', async () => {
    const rawResponse = loadFixture<Record<string, unknown>>('synthid-video.json');
    const expected = loadFixture<Record<string, unknown>>('synthid-video.normalized.json');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(rawResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const client = new SynthIDClient({ apiKey: 'test-key', baseUrl, fetchImpl: fetchMock as unknown as typeof fetch });
    const buffer = Buffer.from('video-bytes');
    const detection = await client.detectVideo({ file: buffer, fileName: 'sample.mp4', mimeType: 'video/mp4' });
    const normalized = normalizeSynthIDResponse(detection);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${baseUrl}/v1/detect/video`);
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get('modality')).toBe('video');
    const fileEntry = body.get('file');
    expect(fileEntry).not.toBeNull();

    expect(normalized).toEqual(expected);
  });

  it('normalizes audio detections preserving confidence', async () => {
    const rawResponse = loadFixture<Record<string, unknown>>('synthid-audio.json');
    const expected = loadFixture<Record<string, unknown>>('synthid-audio.normalized.json');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(rawResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const client = new SynthIDClient({ apiKey: 'test-key', baseUrl, fetchImpl: fetchMock as unknown as typeof fetch });
    const detection = await client.detectAudio({ url: 'https://example.com/audio.wav' });
    const normalized = normalizeSynthIDResponse(detection);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${baseUrl}/v1/detect/audio`);
    const body = init.body as FormData;
    expect(body.get('modality')).toBe('audio');

    expect(normalized).toEqual(expected);
  });
});
