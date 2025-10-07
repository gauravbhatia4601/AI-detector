import { z } from 'zod';

export const pipelineConfigSchema = z.object({
  pollingIntervalMs: z.number().int().positive(),
  maxStatusChecks: z.number().int().positive(),
  sampler: z.object({
    frameRate: z.number().positive(),
    framesPerSample: z.number().int().positive(),
    audioWindowSeconds: z.number().positive(),
    seed: z.number().int().nonnegative(),
  }),
});

export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

const defaults: PipelineConfig = {
  pollingIntervalMs: 1000,
  maxStatusChecks: 30,
  sampler: {
    frameRate: 30,
    framesPerSample: 5,
    audioWindowSeconds: 2,
    seed: 1234,
  },
};

export const resolveConfig = (partial: Partial<PipelineConfig> = {}): PipelineConfig => {
  const merged: PipelineConfig = {
    pollingIntervalMs: partial.pollingIntervalMs ?? defaults.pollingIntervalMs,
    maxStatusChecks: partial.maxStatusChecks ?? defaults.maxStatusChecks,
    sampler: {
      frameRate: partial.sampler?.frameRate ?? defaults.sampler.frameRate,
      framesPerSample: partial.sampler?.framesPerSample ?? defaults.sampler.framesPerSample,
      audioWindowSeconds: partial.sampler?.audioWindowSeconds ?? defaults.sampler.audioWindowSeconds,
      seed: partial.sampler?.seed ?? defaults.sampler.seed,
    },
  };

  return pipelineConfigSchema.parse(merged);
};
