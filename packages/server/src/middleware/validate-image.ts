import type { MiddlewareHandler } from "hono";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE, OCR_LANGUAGES } from "shared";

type Env = {
  Variables: {
    validatedFile: File;
    language: string;
  };
};

export function validateImage(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const formData = await c.req.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No image provided" }, 400);
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      return c.json({ error: "Invalid file type" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: "File too large" }, 413);
    }

    const langParam = formData.get("language") as string | null;
    const language = langParam && langParam in OCR_LANGUAGES ? langParam : "eng";

    c.set("validatedFile", file);
    c.set("language", language);
    await next();
  };
}
