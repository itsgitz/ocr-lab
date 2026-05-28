import { Hono } from "hono";
import { rateLimit } from "../middleware/rate-limit";
import { validateImage } from "../middleware/validate-image";
import { recognizeImage } from "../services/ocr";
import type { OCRLanguage } from "shared";

type Env = {
  Variables: {
    validatedFile: File;
    language: string;
  };
};

const ocr = new Hono<Env>();

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "20", 10);

ocr.use("/api/ocr", rateLimit({ windowMs, max }));
ocr.use("/api/ocr", validateImage());

ocr.post("/api/ocr", async (c) => {
  const file = c.get("validatedFile");
  const lang = c.get("language");

  try {
    const result = await recognizeImage(file, lang as OCRLanguage);
    return c.json(result);
  } catch (err) {
    console.error("OCR processing failed:", err);
    return c.json({ error: "OCR processing failed" }, 500);
  }
});

export default ocr;
