import express from "express";
import multer from "multer";

import { loadSettings } from "./config.js";
import { HiveClient } from "./hiveClient.js";
import { DetectorError, HiveDetectorService } from "./service.js";
import type { DetectorResponse, FrameSample } from "./types.js";

const upload = multer();

export function createService(): HiveDetectorService {
  const settings = loadSettings();
  return new HiveDetectorService(new HiveClient(settings));
}

export function createApp(service: HiveDetectorService = createService()) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/analyze", upload.any(), async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const modality = (req.body.modality ?? req.body.mediaType ?? "image") as
      | "image"
      | "video";

    try {
      if (modality === "image") {
        const file = files.find((item) => item.fieldname === "file") ?? files[0];
        if (!file) {
          res.status(400).json({ error: "missing file" });
          return;
        }
        const result = await service.analyzeImage(file.buffer, file.mimetype ?? "application/octet-stream");
        res.json(result satisfies DetectorResponse);
        return;
      }

      if (modality === "video") {
        const frames = files.filter((item) => item.fieldname === "frames");
        if (frames.length === 0) {
          res.status(400).json({ error: "missing frames" });
          return;
        }
        const samples: FrameSample[] = frames.map((frame, index) => ({
          buffer: frame.buffer,
          contentType: frame.mimetype ?? "image/jpeg",
          frameId: frame.originalname ?? String(index),
        }));
        const result = await service.analyzeVideo(samples);
        res.json(result satisfies DetectorResponse);
        return;
      }

      res.status(400).json({ error: "unsupported modality" });
    } catch (error) {
      if (error instanceof DetectorError) {
        res.status(502).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const port = Number(process.env.PORT ?? "8080");
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Hive detector listening on port ${port}`);
  });
}
