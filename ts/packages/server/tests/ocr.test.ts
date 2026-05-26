import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { initWorker, recognizeImage, terminateWorker, isWorkerReady } from "../src/services/ocr";

// Minimal valid 1x1 white PNG (base64)
const VALID_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

describe("OCR Service", () => {
  beforeEach(async () => {
    await terminateWorker();
  });

  afterEach(async () => {
    await terminateWorker();
  });

  test("isWorkerReady returns false before initialization", () => {
    expect(isWorkerReady()).toBe(false);
  });

  test("initWorker initializes the worker", async () => {
    await initWorker("eng");
    expect(isWorkerReady()).toBe(true);
  });

  test("recognizeImage processes an image and returns OCR result", async () => {
    await initWorker("eng");

    const pngBytes = base64ToUint8Array(VALID_PNG_BASE64);
    const file = new File([pngBytes], "test.png", { type: "image/png" });
    const result = await recognizeImage(file, "eng");

    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("language", "eng");
    expect(result).toHaveProperty("processingTimeMs");
    expect(typeof result.text).toBe("string");
    expect(typeof result.confidence).toBe("number");
    expect(result.processingTimeMs).toBeGreaterThan(0);
  });

  test("recognizeImage initializes worker if not already initialized", async () => {
    const pngBytes = base64ToUint8Array(VALID_PNG_BASE64);
    const file = new File([pngBytes], "test.png", { type: "image/png" });
    const result = await recognizeImage(file, "eng");

    expect(result).toHaveProperty("text");
    expect(isWorkerReady()).toBe(true);
  });
});
