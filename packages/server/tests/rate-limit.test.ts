import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { rateLimit, resetRateLimits, forceCleanup } from "../src/middleware/rate-limit";

describe("Rate Limit Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    resetRateLimits();
    app = new Hono();
    app.use("*", rateLimit({ windowMs: 60000, max: 3 }));
    app.get("/test", (c) => c.json({ ok: true }));
  });

  afterEach(() => {
    resetRateLimits();
  });

  test("allows requests under the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/test", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(res.status).toBe(200);
    }
  });

  test("returns 429 when limit exceeded", async () => {
    for (let i = 0; i < 3; i++) {
      await app.request("/test", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
    }

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body).toEqual({ error: "Too many requests" });
  });

  test("tracks different IPs independently", async () => {
    for (let i = 0; i < 3; i++) {
      await app.request("/test", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
    }

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    });
    expect(res.status).toBe(200);
  });

  test("resets after window expires", async () => {
    const shortApp = new Hono();
    resetRateLimits();
    shortApp.use("*", rateLimit({ windowMs: 50, max: 1 }));
    shortApp.get("/test", (c) => c.json({ ok: true }));

    const res1 = await shortApp.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res1.status).toBe(200);

    const res2 = await shortApp.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res2.status).toBe(429);

    await new Promise((r) => setTimeout(r, 60));

    const res3 = await shortApp.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res3.status).toBe(200);
  });

  test("falls back to x-real-ip when x-forwarded-for is missing", async () => {
    const res = await app.request("/test", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(res.status).toBe(200);

    const res2 = await app.request("/test", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(res2.status).toBe(200);
  });

  test("tracks unknown IPs when no proxy headers present", async () => {
    const res = await app.request("/test"); // no headers
    expect(res.status).toBe(200);
  });

  test("forceCleanup evicts expired entries", async () => {
    const shortApp = new Hono();
    resetRateLimits();
    shortApp.use("*", rateLimit({ windowMs: 30, max: 1 }));
    shortApp.get("/test", (c) => c.json({ ok: true }));

    const res1 = await shortApp.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res1.status).toBe(200);

    const res2 = await shortApp.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res2.status).toBe(429);

    await new Promise((r) => setTimeout(r, 60));

    forceCleanup();

    const res3 = await shortApp.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(res3.status).toBe(200);
  });
});
