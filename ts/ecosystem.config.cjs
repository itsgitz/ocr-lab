module.exports = {
  apps: [
    {
      name: "ocr-lab-server",
      script: "packages/server/src/index.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOST: "0.0.0.0",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      error_file: "/var/log/ocr-lab/error.log",
      out_file: "/var/log/ocr-lab/out.log",
    },
    {
      name: "ocr-lab-frontend",
      script: "packages/frontend/build/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "0.0.0.0",
        PUBLIC_API_URL: "http://localhost:3001",
      },
      instances: 1,
      autorestart: true,
    },
  ],
};
