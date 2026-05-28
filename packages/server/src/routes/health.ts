import { Hono } from "hono";
import type { HealthResponse } from "shared";
import { isWorkerReady } from "../services/ocr";

const startTime = Date.now();

const health = new Hono();

health.get("/api/health", (c) => {
  const response: HealthResponse = {
    status: "ok",
    workerReady: isWorkerReady(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return c.json(response);
});

export default health;
