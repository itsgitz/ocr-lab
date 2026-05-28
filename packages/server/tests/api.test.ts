import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import health from "../src/routes/health";
import { initWorker, terminateWorker } from "../src/services/ocr";

describe("Health Endpoint", () => {
  const app = new Hono();
  app.route("/", health);

  beforeAll(async () => {
    await initWorker("eng");
  });

  afterAll(async () => {
    await terminateWorker();
  });

  test("GET /api/health returns 200 with correct shape", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("workerReady", true);
    expect(body).toHaveProperty("uptime");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test("GET /api/health returns workerReady: false when worker not initialized", async () => {
    await terminateWorker();

    const res = await app.request("/api/health");
    const body = await res.json();

    expect(body.workerReady).toBe(false);
  });
});
