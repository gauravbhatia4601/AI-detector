import { z } from "zod";

export const evidenceSchema = z.object({
  present: z.boolean(),
  confidence: z.number().min(0).max(1),
  modality: z.enum(["image", "video", "audio"]),
  notes: z.array(z.string()).default([]),
});

export const requestSchema = z.object({
  assetId: z.string().min(1),
  modality: z.enum(["image", "video", "audio"]).default("image"),
  detectorSignal: z.union([
    z.string(),
    z.object({
      label: z.string().optional(),
      score: z.number().optional(),
      flags: z.array(z.string()).optional(),
    }),
  ]),
});

export type SynthIdRequest = z.infer<typeof requestSchema>;
export type SynthIdEvidence = z.infer<typeof evidenceSchema>;
