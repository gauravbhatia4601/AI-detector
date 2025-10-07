import { PipelineConfig } from './config.js';
import { DeterministicSampler, SamplingPlan } from './sampler.js';

export interface MediaConvertJobRequest {
  assetId: string;
  inputUrl: string;
  outputBucket: string;
  outputKey: string;
  durationSeconds: number;
}

export interface MediaConvertJob {
  id: string;
  status: 'SUBMITTED' | 'PROGRESSING' | 'COMPLETE' | 'ERROR';
  outputUrl?: string;
  errorMessage?: string;
}

export interface MediaConvertClient {
  createJob(request: MediaConvertJobRequest): Promise<MediaConvertJob>;
  getJob(id: string): Promise<MediaConvertJob>;
}

export interface ProvenanceResult {
  valid: boolean;
  issuer?: string;
  errors?: string[];
}

export interface ProvenanceClient {
  verify(assetUrl: string): Promise<ProvenanceResult>;
}

export interface PipelineResult {
  jobId: string;
  outputUrl: string;
  samplingPlan: SamplingPlan;
  provenance: ProvenanceResult;
}

export type WaitFn = (ms: number) => Promise<void>;

export class MediaPipeline {
  private readonly sampler: DeterministicSampler;

  constructor(
    private readonly mediaConvert: MediaConvertClient,
    private readonly provenance: ProvenanceClient,
    private readonly config: PipelineConfig,
    private readonly wait: WaitFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.sampler = new DeterministicSampler(config.sampler);
  }

  async run(request: MediaConvertJobRequest): Promise<PipelineResult> {
    const created = await this.mediaConvert.createJob(request);
    let status = created;
    let attempts = 0;

    while (
      (status.status === 'SUBMITTED' || status.status === 'PROGRESSING') &&
      attempts < this.config.maxStatusChecks
    ) {
      await this.wait(this.config.pollingIntervalMs);
      status = await this.mediaConvert.getJob(created.id);
      attempts += 1;
    }

    if (status.status !== 'COMPLETE' || !status.outputUrl) {
      throw new Error(status.errorMessage ?? `MediaConvert job ${created.id} failed`);
    }

    const plan = this.sampler.buildPlan(request.assetId, request.durationSeconds);
    const provenance = await this.provenance.verify(status.outputUrl);
    if (!provenance.valid) {
      throw new Error(`C2PA verification failed for ${status.outputUrl}`);
    }

    return {
      jobId: created.id,
      outputUrl: status.outputUrl,
      samplingPlan: plan,
      provenance,
    };
  }
}
