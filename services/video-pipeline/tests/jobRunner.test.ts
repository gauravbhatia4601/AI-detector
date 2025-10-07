import { describe, expect, it, vi } from 'vitest';
import { MediaPipeline } from '../src/jobRunner.js';
import { resolveConfig } from '../src/config.js';

const baseRequest = {
  assetId: 'asset-123',
  inputUrl: 's3://input/video.mov',
  outputBucket: 'outputs',
  outputKey: 'asset-123/output.mov',
  durationSeconds: 12,
};

describe('MediaPipeline', () => {
  it('runs a job and returns provenance-aware output', async () => {
    const config = resolveConfig({ pollingIntervalMs: 10, maxStatusChecks: 5 });
    const createJob = vi.fn().mockResolvedValue({ id: 'job-1', status: 'SUBMITTED' });
    const getJob = vi
      .fn()
      .mockResolvedValueOnce({ id: 'job-1', status: 'PROGRESSING' })
      .mockResolvedValueOnce({ id: 'job-1', status: 'COMPLETE', outputUrl: 's3://outputs/asset-123/output.mov' });
    const verify = vi.fn().mockResolvedValue({ valid: true, issuer: 'Adobe' });
    const wait = vi.fn().mockResolvedValue(undefined);

    const pipeline = new MediaPipeline({ createJob, getJob }, { verify }, config, wait);
    const result = await pipeline.run(baseRequest);

    expect(createJob).toHaveBeenCalledWith(baseRequest);
    expect(getJob).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledWith('s3://outputs/asset-123/output.mov');
    expect(result.samplingPlan.frameSamples.length).toBeGreaterThan(0);
    expect(wait).toHaveBeenCalled();
  });

  it('throws when the job fails', async () => {
    const config = resolveConfig({ pollingIntervalMs: 10, maxStatusChecks: 1 });
    const createJob = vi.fn().mockResolvedValue({ id: 'job-2', status: 'SUBMITTED' });
    const getJob = vi.fn().mockResolvedValue({ id: 'job-2', status: 'ERROR', errorMessage: 'Transcode failed' });
    const pipeline = new MediaPipeline({ createJob, getJob }, { verify: vi.fn() }, config, async () => {});

    await expect(async () => {
      await pipeline.run(baseRequest);
    }).rejects.toThrow(/Transcode failed/);
  });

  it('throws when provenance verification fails', async () => {
    const config = resolveConfig({ pollingIntervalMs: 10, maxStatusChecks: 2 });
    const createJob = vi.fn().mockResolvedValue({ id: 'job-3', status: 'SUBMITTED' });
    const getJob = vi.fn().mockResolvedValue({ id: 'job-3', status: 'COMPLETE', outputUrl: 's3://outputs/out.mov' });
    const verify = vi.fn().mockResolvedValue({ valid: false, errors: ['invalid signature'] });
    const pipeline = new MediaPipeline({ createJob, getJob }, { verify }, config, async () => {});

    await expect(async () => {
      await pipeline.run(baseRequest);
    }).rejects.toThrow(/C2PA verification failed/);
  });

  it('produces deterministic sampling plans', async () => {
    const config = resolveConfig({ sampler: { seed: 1, frameRate: 24, framesPerSample: 3, audioWindowSeconds: 5 } });
    const createJob = vi.fn().mockResolvedValue({ id: 'job-4', status: 'SUBMITTED' });
    const getJob = vi.fn().mockResolvedValue({ id: 'job-4', status: 'COMPLETE', outputUrl: 's3://outputs/out.mov' });
    const verify = vi.fn().mockResolvedValue({ valid: true });
    const pipeline = new MediaPipeline({ createJob, getJob }, { verify }, config, async () => {});

    const result = await pipeline.run(baseRequest);

    expect(result.samplingPlan.frameSamples).toEqual(result.samplingPlan.frameSamples.slice().sort((a, b) => a - b));
    expect(result.samplingPlan.audioOffsetsSeconds.every((offset) => offset >= 0)).toBe(true);
  });
});
