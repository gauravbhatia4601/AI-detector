import { resolveConfig } from './config.js';
import { MediaPipeline } from './jobRunner.js';

interface EnvMediaConvertClient {
  createJob: (request: any) => Promise<any>;
  getJob: (id: string) => Promise<any>;
}

interface EnvProvenanceClient {
  verify: (assetUrl: string) => Promise<any>;
}

const loadJson = (value: string | undefined, fallback: any = {}) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Failed to parse JSON environment value: ${value}`);
  }
};

export const bootstrap = async (
  mediaConvertClient: EnvMediaConvertClient,
  provenanceClient: EnvProvenanceClient,
) => {
  const config = resolveConfig();
  const pipeline = new MediaPipeline(mediaConvertClient, provenanceClient, config);
  const job = loadJson(process.env.PIPELINE_JOB, undefined);
  if (!job) {
    throw new Error('PIPELINE_JOB env var required to start job');
  }
  return pipeline.run(job);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap(
    {
      async createJob(request) {
        throw new Error('MediaConvert client not configured');
      },
      async getJob() {
        throw new Error('MediaConvert client not configured');
      },
    },
    {
      async verify() {
        throw new Error('Provenance client not configured');
      },
    },
  ).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
