import type { DetectionOptions, SynthIDDetectionResponse, SynthIDVerdict } from '../services/watermark-synthid/src/synthidClient';
import { SynthIDClient } from '../services/watermark-synthid/src/synthidClient';
import type {
  DetectorMediaModality,
  DetectorResponse,
  DetectorVerdict,
  EvidenceSegment
} from './schema';

const verdictMap: Record<SynthIDVerdict, DetectorVerdict> = {
  WATERMARK_PRESENT: 'watermark_detected',
  WATERMARK_ABSENT: 'not_detected',
  INCONCLUSIVE: 'inconclusive'
};

function toDetectorModality(modality: string): DetectorMediaModality {
  const lowered = modality.toLowerCase();
  if (lowered === 'image' || lowered === 'video' || lowered === 'audio') {
    return lowered;
  }

  throw new Error(`Unsupported modality returned by SynthID: ${modality}`);
}

function normalizeSegments(segments: SynthIDDetectionResponse['segments']): EvidenceSegment[] {
  if (!segments || segments.length === 0) {
    return [];
  }

  return segments.map((segment) => ({
    startTimeMs: segment.startTimeMs,
    endTimeMs: segment.endTimeMs,
    verdict: verdictMap[segment.verdict],
    confidence: segment.confidence ?? null,
    notes: segment.explanation ? [segment.explanation] : undefined
  }));
}

export function normalizeSynthIDResponse(response: SynthIDDetectionResponse): DetectorResponse {
  const modality = toDetectorModality(response.modality);
  const notes: string[] = [];

  if (response.overall.explanation) {
    notes.push(response.overall.explanation);
  }

  const evidenceSegments = normalizeSegments(response.segments);

  const normalized: DetectorResponse = {
    detector: 'synthid',
    requestId: response.requestId,
    evidence: {
      modality,
      verdict: verdictMap[response.overall.verdict],
      confidence: response.overall.confidence ?? null,
      notes,
      segments: evidenceSegments,
      raw: response
    }
  };

  return normalized;
}

export interface DetectorRunOptions extends DetectionOptions {
  modality: DetectorMediaModality;
}

export async function runSynthIDDetection(
  client: SynthIDClient,
  options: DetectorRunOptions
): Promise<DetectorResponse> {
  let response: SynthIDDetectionResponse;

  switch (options.modality) {
    case 'image':
      response = await client.detectImage(options);
      break;
    case 'video':
      response = await client.detectVideo(options);
      break;
    case 'audio':
      response = await client.detectAudio(options);
      break;
    default:
      throw new Error(`Unsupported modality: ${options.modality}`);
  }

  return normalizeSynthIDResponse(response);
}
