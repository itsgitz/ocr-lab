import { createWorker } from "tesseract.js";
import type { OCRResult } from "shared";

let worker: Tesseract.Worker | null = null;
let isInitialized = false;

export async function initWorker(lang = "eng"): Promise<void> {
  if (isInitialized && worker) return;

  worker = await createWorker(lang);
  isInitialized = true;
}

export async function recognizeImage(
  image: File,
  lang = "eng"
): Promise<OCRResult> {
  if (!worker || !isInitialized) {
    await initWorker(lang);
  }

  const arrayBuffer = await image.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const start = performance.now();
  const { data } = await worker!.recognize(uint8Array);
  const processingTimeMs = Math.round(performance.now() - start);

  return {
    text: data.text.trim(),
    confidence: Math.round(data.confidence * 100) / 100,
    language: lang,
    processingTimeMs,
  };
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    isInitialized = false;
  }
}

export function isWorkerReady(): boolean {
  return isInitialized && worker !== null;
}
