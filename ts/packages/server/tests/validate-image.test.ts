import { test, expect, describe, beforeEach } from "bun:test";
import { Hono } from "hono";
import { validateImage } from "../src/middleware/validate-image";

describe("Validate Image Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.post("/test", validateImage(), (c) => c.json({ ok: true }));
  });

  test("accepts valid PNG image", async () => {
    const formData = new FormData();
    const pngData = new Uint8Array([137, 80, 78, 71]);
    formData.append("image", new File([pngData], "test.png", { type: "image/png" }));

    const res = await app.request("/test", { method: "POST", body: formData });
    expect(res.status).toBe(200);
  });

  test("accepts valid JPEG image", async () => {
    const formData = new FormData();
    const jpegData = new Uint8Array([255, 216, 255, 224]);
    formData.append("image", new File([jpegData], "test.jpg", { type: "image/jpeg" }));

    const res = await app.request("/test", { method: "POST", body: formData });
    expect(res.status).toBe(200);
  });

  test("returns 400 when no file provided", async () => {
    const formData = new FormData();

    const res = await app.request("/test", { method: "POST", body: formData });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: "No image provided" });
  });

  test("returns 400 for non-image file type", async () => {
    const formData = new FormData();
    const textData = new Uint8Array([72, 101, 108, 108, 111]);
    formData.append("image", new File([textData], "test.txt", { type: "text/plain" }));

    const res = await app.request("/test", { method: "POST", body: formData });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: "Invalid file type" });
  });

  test("returns 413 when file exceeds size limit", async () => {
    const formData = new FormData();
    const largeData = new Uint8Array(11 * 1024 * 1024);
    formData.append("image", new File([largeData], "large.png", { type: "image/png" }));

    const res = await app.request("/test", { method: "POST", body: formData });
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body).toEqual({ error: "File too large" });
  });

  test("accepts all allowed image types", async () => {
    const types = ["image/png", "image/jpeg", "image/gif", "image/bmp", "image/webp"];

    for (const type of types) {
      const formData = new FormData();
      const data = new Uint8Array([1, 2, 3, 4]);
      formData.append("image", new File([data], `test.${type.split("/")[1]}`, { type }));

      const res = await app.request("/test", { method: "POST", body: formData });
      expect(res.status).toBe(200);
    }
  });
});
