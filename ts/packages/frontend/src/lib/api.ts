import type { OCRResult } from "shared";

const API_URL = process.env.PUBLIC_API_URL || "http://localhost:3001";

export async function processOCR(
  image: File,
  language: string,
): Promise<OCRResult> {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("language", language);

  const response = await fetch(`${API_URL}/api/ocr`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body: { error?: string } = await response.json();
    throw new Error(body.error || "OCR processing failed");
  }

  return response.json() as Promise<OCRResult>;
}
