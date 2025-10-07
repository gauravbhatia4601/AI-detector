export interface SamplingPlan {
  frameSamples: number[];
  audioOffsetsSeconds: number[];
}

export interface SamplerConfig {
  frameRate: number;
  framesPerSample: number;
  audioWindowSeconds: number;
  seed: number;
}

export class DeterministicSampler {
  constructor(private readonly config: SamplerConfig) {}

  private seededRandom(seed: number): () => number {
    let value = seed % 2147483647;
    if (value <= 0) {
      value += 2147483646;
    }
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  buildPlan(assetId: string, durationSeconds: number): SamplingPlan {
    const totalFrames = Math.floor(durationSeconds * this.config.frameRate);
    const random = this.seededRandom(this.hashSeed(assetId));
    const frameSamples: number[] = [];

    for (let i = 0; i < this.config.framesPerSample; i += 1) {
      const frame = Math.floor(random() * totalFrames);
      frameSamples.push(frame);
    }

    const audioOffsetsSeconds: number[] = [];
    const windows = Math.max(1, Math.floor(durationSeconds / this.config.audioWindowSeconds));
    for (let i = 0; i < windows; i += 1) {
      const offset = Math.min(durationSeconds, i * this.config.audioWindowSeconds + random());
      audioOffsetsSeconds.push(Number(offset.toFixed(3)));
    }

    return {
      frameSamples: frameSamples.sort((a, b) => a - b),
      audioOffsetsSeconds,
    };
  }

  private hashSeed(assetId: string): number {
    let hash = this.config.seed;
    for (let i = 0; i < assetId.length; i += 1) {
      hash = (hash * 31 + assetId.charCodeAt(i)) >>> 0;
    }
    return hash;
  }
}
