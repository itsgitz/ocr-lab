import { Hono } from "hono";
import { cors } from "hono/cors";
import health from "./routes/health";
import ocr from "./routes/ocr";
import { initWorker, terminateWorker } from "./services/ocr";
import { startCleanupTimer } from "./middleware/rate-limit";

const app = new Hono();

app.use("*", cors());

app.route("/", health);
app.route("/", ocr);

const port = parseInt(process.env.PORT || "3001", 10);
const host = process.env.HOST || "0.0.0.0";

const server = Bun.serve({
  fetch: app.fetch,
  port,
  hostname: host,
  maxRequestBodySize: 10 * 1024 * 1024,
});

console.log(`🚀 OCR Lab server running on http://${host}:${port}`);

async function gracefulShutdown() {
  console.log("\n🛑 Shutting down gracefully...");
  await terminateWorker();
  server.stop();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Initialize worker on startup
initWorker(process.env.OCR_DEFAULT_LANG || "eng").then(() => {
  console.log("✅ Tesseract.js worker initialized");
});

// Periodic cleanup of rate-limit store (every 60s)
startCleanupTimer(60000);
