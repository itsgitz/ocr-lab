import type { OCRResult } from "shared";

const API_URL = process.env.PUBLIC_API_URL || "http://localhost:3001";

export async function processOCR(
  image: File,
  language: string,
): Promise<OCRResult> {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("language", language);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/ocr`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`fetch to ${API_URL}/api/ocr failed:`, msg);
    throw new Error(`OCR request to ${API_URL}/api/ocr failed: ${msg}`);
  }

  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(body.error || `OCR processing failed (HTTP ${response.status})`);
  }

  return response.json() as Promise<OCRResult>;
}
