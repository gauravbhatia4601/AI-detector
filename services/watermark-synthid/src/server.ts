import express, { Request, Response } from "express";
import morgan from "morgan";
import { normalizeEvidence } from "./detector.js";
import { requestSchema } from "./schema.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(morgan("tiny"));

app.post("/check", (req: Request, res: Response) => {
  const parseResult = requestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ errors: parseResult.error.issues });
    return;
  }

  const evidence = normalizeEvidence(parseResult.data);
  res.json(evidence);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 8081;
app.listen(port, () => {
  console.log(`watermark-synthid listening on ${port}`);
});

export default app;
