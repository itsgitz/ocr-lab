const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

const envFile = path.join(__dirname, ".env");
const env = loadEnv(envFile);

const PORT = env.PORT || process.env.PORT || "3001";
const HOST = env.HOST || process.env.HOST || "0.0.0.0";
const FRONTEND_PORT = env.FRONTEND_PORT || process.env.FRONTEND_PORT || "3000";
const OCR_DEFAULT_LANG = env.OCR_DEFAULT_LANG || process.env.OCR_DEFAULT_LANG || "eng";
const RATE_LIMIT_WINDOW_MS = env.RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW_MS || "60000";
const RATE_LIMIT_MAX_REQUESTS = env.RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_MAX_REQUESTS || "20";
const PUBLIC_API_URL = env.PUBLIC_API_URL || process.env.PUBLIC_API_URL || `http://localhost:${PORT}`;
const ORIGIN = env.ORIGIN || process.env.ORIGIN || "";
const BUN_PATH = env.BUN_PATH || process.env.BUN_PATH || "bun";

const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = {
  apps: [
    {
      name: "ocr-lab-server",
      script: "packages/server/src/index.ts",
      interpreter: BUN_PATH,
      exec_mode: "fork",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT,
        HOST,
        OCR_DEFAULT_LANG,
        RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_REQUESTS,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      error_file: path.join(logsDir, "server-error.log"),
      out_file: path.join(logsDir, "server-out.log"),
    },
    {
      name: "ocr-lab-frontend",
      script: "packages/frontend/build/index.js",
      interpreter: "node",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: FRONTEND_PORT,
        HOST,
        PUBLIC_API_URL,
        ORIGIN,
      },
      instances: 1,
      autorestart: true,
      error_file: path.join(logsDir, "frontend-error.log"),
      out_file: path.join(logsDir, "frontend-out.log"),
    },
  ],
};
