import nock from "nock";
import request from "supertest";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { loadSettings } from "../src/config.js";
import { HiveClient } from "../src/hiveClient.js";
import { createApp, createService } from "../src/main.js";
import { HiveDetectorService } from "../src/service.js";

function buildService(baseUrl: string) {
  const settings = { ...loadSettings(), baseUrl };
  return new HiveDetectorService(new HiveClient(settings));
}

beforeEach(() => {
  nock.cleanAll();
});

afterEach(() => {
  delete process.env.HIVE_BACKEND;
  delete process.env.HIVE_NIM_BASE_URL;
  delete process.env.HIVE_BASE_URL;
  nock.cleanAll();
});

describe("Hive detector", () => {
  it("analyzes images", async () => {
    const baseUrl = "https://api.thehive.ai/api/v2";
    const scope = nock(baseUrl)
      .post("/deepfake")
      .reply(200, { result: { label: "real", score: 0.12, reasons: ["texture"], modelVersion: "hive-1" } });

    const app = createApp(buildService(baseUrl));
    const response = await request(app)
      .post("/analyze")
      .field("modality", "image")
      .attach("file", Buffer.from("image-bytes"), { filename: "frame.jpg", contentType: "image/jpeg" });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({
      label: "real",
      score: 0.12,
      reasons: ["texture"],
      modelVersion: "hive-1",
    });
    expect(scope.isDone()).toBe(true);
  });

  it("aggregates frame results", async () => {
    const baseUrl = "https://api.thehive.ai/api/v2";
    const scope = nock(baseUrl)
      .post("/deepfake/batch")
      .reply(200, {
        results: [
          { frameId: "0", label: "real", score: 0.2, reasons: ["motion"], modelVersion: "hive-2" },
          { frameId: "1", label: "fake", score: 0.92, reasons: ["mouth"], modelVersion: "hive-2" },
        ],
      });

    const app = createApp(buildService(baseUrl));
    const response = await request(app)
      .post("/analyze")
      .field("modality", "video")
      .attach("frames", Buffer.from("frame-one"), { filename: "0.jpg", contentType: "image/jpeg" })
      .attach("frames", Buffer.from("frame-two"), { filename: "1.jpg", contentType: "image/jpeg" });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.label).toBe("fake");
    expect(response.body.score).toBeCloseTo(0.92, 2);
    expect(response.body.reasons).toEqual(expect.arrayContaining(["frame:0", "frame:1", "mouth", "motion"]));
    expect(response.body.modelVersion).toBe("hive-2");
    expect(scope.isDone()).toBe(true);
  });

  it("supports NIM backend", async () => {
    process.env.HIVE_BACKEND = "nim";
    process.env.HIVE_NIM_BASE_URL = "https://nim.example.com/api";

    const service = createService();
    const scope = nock("https://nim.example.com")
      .post("/api/deepfake")
      .reply(200, { label: "real", score: 0.5, reasons: [], modelVersion: "nim-1" });

    const app = createApp(service);
    const response = await request(app)
      .post("/analyze")
      .field("modality", "image")
      .attach("file", Buffer.from("img"), { filename: "f.jpg", contentType: "image/jpeg" });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(scope.isDone()).toBe(true);
  });
});
