import { test, expect, describe, beforeEach, mock, afterEach } from "bun:test";
import { Hono } from "hono";
import { resetRateLimits } from "../src/middleware/rate-limit";

const mockRecognizeImage = mock();

mock.module("../src/services/ocr", () => ({
  recognizeImage: mockRecognizeImage,
  initWorker: mock(),
  terminateWorker: mock(),
  isWorkerReady: () => true,
}));

import ocr from "../src/routes/ocr";

describe("OCR Route", () => {
  let app: Hono;

  beforeEach(() => {
    resetRateLimits();
    mockRecognizeImage.mockReset();
    app = new Hono();
    app.route("/", ocr);
  });

  afterEach(() => {
    mockRecognizeImage.mockReset();
  });

  test("POST /api/ocr returns 200 with OCR result for valid image", async () => {
    mockRecognizeImage.mockResolvedValue({
      text: "Hello World",
      confidence: 95.5,
      language: "eng",
      processingTimeMs: 500,
    });

    const formData = new FormData();
    const pngData = new Uint8Array([137, 80, 78, 71]);
    formData.append("image", new File([pngData], "test.png", { type: "image/png" }));

    const res = await app.request("/api/ocr", { method: "POST", body: formData });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      text: "Hello World",
      confidence: 95.5,
      language: "eng",
      processingTimeMs: 500,
    });
  });

  test("POST /api/ocr returns 400 when no file provided", async () => {
    const formData = new FormData();

    const res = await app.request("/api/ocr", { method: "POST", body: formData });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: "No image provided" });
  });

  test("POST /api/ocr returns 400 for non-image file type", async () => {
    const formData = new FormData();
    const textData = new Uint8Array([72, 101, 108, 108, 111]);
    formData.append("image", new File([textData], "test.txt", { type: "text/plain" }));

    const res = await app.request("/api/ocr", { method: "POST", body: formData });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: "Invalid file type" });
  });

  test("POST /api/ocr returns 413 when file exceeds size limit", async () => {
    const formData = new FormData();
    const largeData = new Uint8Array(11 * 1024 * 1024);
    formData.append("image", new File([largeData], "large.png", { type: "image/png" }));

    const res = await app.request("/api/ocr", { method: "POST", body: formData });
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body).toEqual({ error: "File too large" });
  });

  test("POST /api/ocr returns 429 when rate limit exceeded", async () => {
    mockRecognizeImage.mockResolvedValue({
      text: "test",
      confidence: 90,
      language: "eng",
      processingTimeMs: 100,
    });

    const formData = new FormData();
    const pngData = new Uint8Array([137, 80, 78, 71]);
    formData.append("image", new File([pngData], "test.png", { type: "image/png" }));

    for (let i = 0; i < 20; i++) {
      await app.request("/api/ocr", {
        method: "POST",
        body: formData,
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
    }

    const res = await app.request("/api/ocr", {
      method: "POST",
      body: formData,
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body).toEqual({ error: "Too many requests" });
  });

  test("POST /api/ocr returns 500 when OCR processing fails", async () => {
    mockRecognizeImage.mockRejectedValue(new Error("OCR engine failure"));

    const formData = new FormData();
    const pngData = new Uint8Array([137, 80, 78, 71]);
    formData.append("image", new File([pngData], "test.png", { type: "image/png" }));

    const res = await app.request("/api/ocr", { method: "POST", body: formData });
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body).toEqual({ error: "OCR processing failed" });
  });

  test("POST /api/ocr passes language parameter to OCR service", async () => {
    mockRecognizeImage.mockResolvedValue({
      text: "Bonjour",
      confidence: 88,
      language: "fra",
      processingTimeMs: 600,
    });

    const formData = new FormData();
    const pngData = new Uint8Array([137, 80, 78, 71]);
    formData.append("image", new File([pngData], "test.png", { type: "image/png" }));
    formData.append("language", "fra");

    const res = await app.request("/api/ocr", { method: "POST", body: formData });
    expect(res.status).toBe(200);

    expect(mockRecognizeImage).toHaveBeenCalled();
    const callArgs = mockRecognizeImage.mock.calls[0];
    expect(callArgs[1]).toBe("fra");
  });
});
