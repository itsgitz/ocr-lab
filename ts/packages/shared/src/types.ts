export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  processingTimeMs: number;
}

export interface HealthResponse {
  status: "ok";
  workerReady: boolean;
  uptime: number;
}

export const OCR_LANGUAGES = {
  eng: "English",
  chi_sim: "Chinese (Simplified)",
  jpn: "Japanese",
  kor: "Korean",
  fra: "French",
  deu: "German",
  spa: "Spanish",
} as const;

export type OCRLanguage = keyof typeof OCR_LANGUAGES;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/bmp",
  "image/webp",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
