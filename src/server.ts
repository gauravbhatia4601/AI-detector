import express from 'express';
import multer from 'multer';
import type { Request, Response } from 'express';
import { SynthIDClient, SynthIDClientError } from '../services/watermark-synthid/src/synthidClient';
import { runSynthIDDetection } from './detector';
import type { DetectorApiResponse, DetectorMediaModality } from './schema';

const upload = multer({ storage: multer.memoryStorage() });

function resolveModality(value: unknown): DetectorMediaModality {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if (normalized === 'image' || normalized === 'video' || normalized === 'audio') {
    return normalized;
  }

  throw new Error('Unsupported or missing modality. Expected image, video, or audio.');
}

let cachedClient: SynthIDClient | null = null;

function getSynthIdClient(): SynthIDClient {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.SYNTHID_API_KEY;
  if (!apiKey) {
    throw new Error('SYNTHID_API_KEY environment variable is required');
  }

  cachedClient = new SynthIDClient({
    apiKey,
    baseUrl: process.env.SYNTHID_BASE_URL
  });

  return cachedClient;
}

export const app = express();
app.use(express.json());

app.post('/detect', upload.single('media'), async (req: Request, res: Response<DetectorApiResponse>) => {
  try {
    const modality = resolveModality(req.body?.modality);
    const mediaUrl: string | undefined = req.body?.url ?? req.body?.mediaUrl;
    const file = req.file?.buffer;

    if (!file && !mediaUrl) {
      res.status(400).json({
        error: 'A media file upload or url parameter is required.'
      });
      return;
    }

    const client = getSynthIdClient();
    const normalized = await runSynthIDDetection(client, {
      modality,
      url: mediaUrl,
      file: file,
      fileName: req.file?.originalname,
      mimeType: req.file?.mimetype
    });

    res.json(normalized);
  } catch (error) {
    if (error instanceof SynthIDClientError) {
      res.status(error.status ?? 502).json({
        error: error.message,
        status: error.status ?? 502
      });
      return;
    }

    res.status(400).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`SynthID detector listening on port ${port}`);
  });
}
