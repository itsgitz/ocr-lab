# Docker Deployment Guide

This guide covers building, running, and managing OCR Lab with Docker. After completing this guide, you can ship the entire stack with a single command on any machine that has Docker installed — no Bun, Node.js, or PM2 required on the host.

---

## Architecture

```
Host machine
├── :3000  ──► ocr-lab-frontend  (node:20-alpine, SvelteKit SSR)
│                    │
│              ocr-net (bridge)
│                    │
└── :3001  ──► ocr-lab-server   (oven/bun:1, Hono + Tesseract.js)
```

- Two containers communicate over an internal Docker bridge network (`ocr-net`).
- The frontend calls the server **by container name** (`http://ocr-lab-server:3001`) — never `localhost`.
- Both ports are published to the host for direct access and reverse-proxy compatibility.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Docker Engine | 24+ |
| Docker Compose plugin | v2.20+ |

Verify:

```bash
docker version
docker compose version
```

> Bun and Node.js are **not** required on the host. They are bundled inside the images.

---

## Project Structure (after migration)

```
ts/
├── docker-compose.yml            # Orchestrates both services
├── .dockerignore                 # Root-level build context rules
├── .env                          # Runtime config (gitignored)
├── .env.example                  # Template for bare-metal / PM2
├── .env.docker.example           # Template for Docker (use this one)
├── packages/
│   ├── server/
│   │   └── Dockerfile            # Multi-stage: deps → production
│   └── frontend/
│       └── Dockerfile            # Multi-stage: deps → build → production
└── docs/
    └── plans/
        └── docker.md             # This guide
```

---

## Environment Configuration

Docker changes how services discover each other. Copy `.env.docker.example` instead of `.env.example`:

```bash
cp .env.docker.example .env
```

### Key differences from the PM2 / bare-metal `.env`

| Variable | Bare-metal value | Docker value | Why |
|----------|-----------------|--------------|-----|
| `PUBLIC_API_URL` | `http://localhost:3001` | `http://ocr-lab-server:3001` | Frontend container must use the server's **container name**, not `localhost` |
| `ORIGIN` | `http://<vps-ip>:3000` | `http://localhost:3000` (local) or `http://<vps-ip>:3000` (remote) | Same CSRF rule applies |
| `BUN_PATH` | `/home/user/.bun/bin/bun` | *(omit)* | Bun is already in `PATH` inside `oven/bun` image |
| `BODY_SIZE_LIMIT` | *(not set — bare-metal PM2 runs server directly)* | `Infinity` | adapter-node defaults to 512KB; must allow large image pass-through |
| `PORT` | `3001` in `.env` | Overridden in frontend compose `environment:` | Both services read `PORT`; frontend overrides to `3000` via compose `environment:`, server uses `.env`'s `3001` directly |

### Full variable reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Hono API bind port. **Important:** adapter-node also reads `PORT` — see PORT conflict note below |
| `HOST` | `0.0.0.0` | Bind address (keep `0.0.0.0` inside container) |
| `OCR_DEFAULT_LANG` | `eng` | Default Tesseract language |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX_REQUESTS` | `20` | Max requests per IP per window |
| `PUBLIC_API_URL` | `http://ocr-lab-server:3001` | Server-side API fetch URL (use container name). **Note:** This URL is only resolvable from the frontend container via Docker DNS. Client-side JavaScript in the browser cannot resolve Docker service names and will fail if it attempts to use this URL directly. Keep all API calls server-side (SvelteKit form actions, server hooks). |
| `ORIGIN` | `http://localhost:3000` | SvelteKit adapter-node origin — prevents CSRF 403 |
| `BODY_SIZE_LIMIT` | `512KB` | adapter-node request body limit. **Must set to `Infinity` or `10485760`** — default 512KB rejects image uploads before they reach the API |

> **PORT conflict:** Both the server (`packages/server/src/index.ts`) and the frontend (`adapter-node`) read the `PORT` environment variable. Since both services share the same `.env` file via `env_file:`, the frontend overrides `PORT=3000` in its `environment:` block. The server uses `.env`'s `PORT=3001` directly, so no override is needed there. Do NOT rely on `FRONTEND_PORT` — adapter-node does not read it.

---

## `.env.docker.example` Template

Create `.env.docker.example` with the following contents:

```env
# Server
PORT=3001
HOST=0.0.0.0
OCR_DEFAULT_LANG=eng
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20

# Frontend (SvelteKit)
PUBLIC_API_URL=http://ocr-lab-server:3001

# adapter-node body size limit — default is 512KB which rejects image uploads.
# Set to Infinity to let the backend (10MB limit) handle validation.
BODY_SIZE_LIMIT=Infinity

# SvelteKit adapter-node origin — must match the URL users access in the browser
# Prevents CSRF 403 errors. Replace with your server IP or domain.
ORIGIN=http://REPLACE_WITH_YOUR_IP:3000
```

> **Note:** `PORT` is set via `environment:` in `docker-compose.yml` for the frontend service (overriding `.env`'s `PORT=3001`). The server reads `PORT=3001` directly from `.env`. All other variables (`BODY_SIZE_LIMIT`, `ORIGIN`, etc.) are sourced from `.env` via `env_file:` — no duplication needed.

---

## Dockerfile Specifications

### `packages/server/Dockerfile`

**Runtime:** `oven/bun:1`  
**Strategy:** Install dependencies at monorepo root, run TypeScript source directly with Bun (no transpile step needed).

**Build stages:**

| Stage | Base image | Purpose |
|-------|-----------|---------|
| `deps` | `oven/bun:1` | Install all workspace dependencies |
| `production` | `oven/bun:1` | Copy deps + source; run server |

```dockerfile
# packages/server/Dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
# Copy workspace root manifests first for layer caching
COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json
# Install all workspace deps (bun needs full workspace structure)
# BuildKit cache mount avoids re-downloading packages on repeated builds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1 AS production
WORKDIR /app
# Copy deps from the deps stage — no shell operators, these directories exist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
# Copy source code
COPY packages/server/ packages/server/
COPY packages/shared/ packages/shared/
COPY package.json ./

USER bun
EXPOSE 3001
CMD ["bun", "run", "packages/server/src/index.ts"]
```

**Key decisions:**
- Build context is the **monorepo root** (set in `docker-compose.yml`) so `packages/shared/` is accessible.
- All `packages/*/package.json` files are copied before `bun install` to enable workspace resolution and Docker layer caching.
- Tesseract.js downloads language data from the jsdelivr CDN at runtime (requires outbound internet access).
- Runs as non-root user (`bun`) for security.
- Exposes port `3001`.
- **BuildKit cache mount** (`--mount=type=cache,target=/root/.bun/install/cache`) avoids re-downloading all packages on repeated builds — the Bun cache persists across build invocations.
- **No `COPY` for `packages/shared/node_modules`** — the `shared` package has zero npm dependencies (`package.json` only has `exports`), so `bun install` never creates `packages/shared/node_modules/`. Attempting to `COPY` it from the `deps` stage would fail with "not found". Only `packages/server/node_modules` and root `node_modules` are copied.

### `packages/frontend/Dockerfile`

**Build runtime:** `oven/bun:1` (fastest package install + Vite build)  
**Production runtime:** `node:20-alpine` (SvelteKit adapter-node output is plain Node.js)  
**Strategy:** Three-stage build to keep the final image small.

**Build stages:**

| Stage | Base image | Purpose |
|-------|-----------|---------|
| `deps` | `oven/bun:1` | Install all workspace dependencies |
| `builder` | `oven/bun:1` | Run `bun run build:frontend` → produces `packages/frontend/build/` |
| `production` | `node:20-alpine` | Copy only compiled build output; run Node |

```dockerfile
# packages/frontend/Dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
# Copy workspace manifests first for layer caching
COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json
# BuildKit cache mount avoids re-downloading packages on repeated builds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
# Copy deps from deps stage — all directories exist after bun install
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
# Copy all source needed for the build
COPY packages/frontend/ packages/frontend/
COPY packages/shared/ packages/shared/
COPY package.json tsconfig.json ./
RUN bun run build:frontend

FROM node:20-alpine AS production
WORKDIR /app
# Copy only the self-contained build output
COPY --from=builder /app/packages/frontend/build ./build

USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
```

**Key decisions:**
- Only the compiled `packages/frontend/build/` directory is copied to the final stage — source files and devDependencies are excluded. The build output is fully self-contained.
- The `tsconfig.json` is copied to the builder stage because `packages/shared` uses path aliases that may be resolved during build.
- Runs as non-root user (`node`) for security.
- Exposes port `3000`.
- **BuildKit cache mount** (`--mount=type=cache`) used in `deps` stage for accelerated rebuilds.
- **No `COPY` for `packages/shared/node_modules`** — shared has zero dependencies, so the directory never exists after `bun install`.

---

## `docker-compose.yml` Specification

```yaml
services:
  ocr-lab-server:
    build:
      context: .                        # monorepo root
      dockerfile: packages/server/Dockerfile
    ports:
      - "3001:3001"
    env_file: .env
    networks:
      - ocr-net
    restart: unless-stopped
    healthcheck:
      # Validates both HTTP status AND worker readiness — /api/health returns 200
      # even when workerReady:false. The JSON body check prevents the frontend
      # from starting before the Tesseract worker finishes initializing.
      test: ["CMD", "bun", "-e", "const r = await fetch('http://localhost:3001/api/health'); const j = await r.json(); if(!r.ok || !j.workerReady) process.exit(1)"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          # Tesseract.js loads ~5MB language data per language (+ WASM overhead).
          # 768MB minimum recommended; 1G safe for concurrent OCR processing.
          memory: 1G

  ocr-lab-frontend:
    build:
      context: .                        # monorepo root
      dockerfile: packages/frontend/Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      - PORT=3000                       # adapter-node reads PORT, not FRONTEND_PORT
    depends_on:
      ocr-lab-server:
        condition: service_healthy      # wait for /api/health to pass
    networks:
      - ocr-net
    restart: unless-stopped

networks:
  ocr-net:
    driver: bridge
```

**Why `context: .`?**  
Both Dockerfiles need access to the full monorepo (shared package, `bun.lock`). Setting `context` to the repo root ensures `COPY` instructions can reach everything.

---

## `.dockerignore` Rules

Place this at the monorepo root (`ts/.dockerignore`):

```dockerignore
# Dependencies (rebuilt inside image)
node_modules/
packages/*/node_modules/

# Frontend build output & generated code (rebuilt inside image)
packages/frontend/build/
.svelte-kit/

# Runtime / local state
logs/
.env
.env.*

# Version control
.git/
.gitignore

# Editor / tooling
.opencode/
.vscode/
*.log

# Documentation (not needed in image)
docs/
*.md
README*
```

> **Note:** `.svelte-kit/` is excluded because it's a generated directory (SvelteKit type definitions and intermediate build artifacts). It would be wasted data in the build context since the frontend runs a clean `bun run build:frontend` inside the Docker build.
>
> Tesseract trained data files are not needed in the Docker build context. Tesseract.js downloads language data from the jsdelivr CDN at runtime.

---

## Quick Start

```bash
# 1. Configure environment
cp .env.docker.example .env
# Open .env and verify PUBLIC_API_URL=http://ocr-lab-server:3001
# Set ORIGIN to your access URL (http://localhost:3000 for local, http://<ip>:3000 for remote)

# 2. Build and start both services
docker compose up --build

# 3. Verify
curl http://localhost:3001/api/health
# → {"status":"ok","workerReady":true,...}

# Open http://localhost:3000 in your browser
```

### Common commands

```bash
# Run in background
docker compose up --build -d

# Stream logs (all services)
docker compose logs -f

# Stream logs (single service)
docker compose logs -f ocr-lab-server

# Stop and remove containers (keeps images)
docker compose down

# Stop and remove containers + images
docker compose down --rmi all

# Rebuild a single service without restarting the other
docker compose up --build ocr-lab-server -d

# Open a shell in the running server container
docker compose exec ocr-lab-server sh
```

---

## Production Deployment

### Replacing the PM2 workflow

| Step | PM2 (before) | Docker (after) |
|------|-------------|----------------|
| Deploy update | `git pull && bun run build:frontend && pm2 restart ocr-lab-frontend` | `git pull && docker compose up --build -d` |
| View logs | `pm2 logs` | `docker compose logs -f` |
| Restart a service | `pm2 restart ocr-lab-server` | `docker compose restart ocr-lab-server` |
| Check status | `pm2 list` | `docker compose ps` |

### Full redeploy workflow

```bash
git pull
docker compose up --build -d
docker compose logs -f   # watch startup and verify health
```

Docker rebuilds both images on every deploy, which guarantees deterministic state. There is no stale build artifact problem (unlike PM2 where you must manually re-run `bun run build:frontend`).

### PM2 vs Docker comparison

| Concern | PM2 | Docker |
|---------|-----|--------|
| Bun version | Pinned via `BUN_PATH` env var | Pinned via `oven/bun:1` image tag |
| Node version | Host's installed version | `node:20-alpine` image tag |
| Env isolation | `.env` file loaded by `ecosystem.config.cjs` | `.env` file via `env_file:` in Compose |
| Process restart | `autorestart: true` | `restart: unless-stopped` |
| Memory limit | `max_memory_restart: 500M` | `mem_limit: 500m` in Compose |
| Log access | `logs/` directory, `pm2 logs` | `docker compose logs` |
| Deploy command | `pm2 restart` + manual rebuild | `docker compose up --build -d` |
| System startup | `pm2 startup && pm2 save` | Docker Desktop / systemd `docker.service` |

### Auto-start on reboot (VPS)

Docker Engine on Linux auto-starts with systemd. Containers with `restart: unless-stopped` will come back up automatically after a reboot — no `pm2 startup` equivalent needed.

Verify Docker starts on boot:

```bash
sudo systemctl is-enabled docker
# → enabled
```

---

## Healthchecks and Readiness

The server container exposes `GET /api/health` which Docker polls every 30 seconds:

```
interval: 30s   — check every 30 seconds
timeout: 10s    — fail if no response within 10 seconds
retries: 3      — mark unhealthy after 3 consecutive failures
start_period: 15s — grace period for Tesseract worker initialization
```

**Important:** The healthcheck validates both the HTTP status AND the `workerReady` field in the JSON response body. `/api/health` always returns HTTP 200 (even when the Tesseract worker hasn't finished initializing), so a simple `if(!r.ok)` check would incorrectly report the server as healthy before the worker is ready. The healthcheck command parses the response body to confirm the worker is fully initialized:

```yaml
test: ["CMD", "bun", "-e", "const r = await fetch('http://localhost:3001/api/health'); const j = await r.json(); if(!r.ok || !j.workerReady) process.exit(1)"]
```

The frontend container will not start until the server reports `healthy`. This prevents the frontend from receiving connection errors during server cold-start (Tesseract worker initialization takes a few seconds).

---

## Tesseract Language Data

Tesseract.js downloads language data files from the [jsdelivr CDN](https://cdn.jsdelivr.net/npm/@tesseract.js-data/) at runtime when a language is first requested. This approach:

- **Simplifies deployment** — no need to manage `.traineddata` files
- **Supports all 7 languages** — English, Chinese (Simplified), Japanese, Korean, French, German, Spanish
- **Requires outbound internet** — the Docker container must have access to `cdn.jsdelivr.net`

If your environment restricts internet access, consider downloading `.traineddata` files during Docker build and configuring `Tesseract.js` with a custom `langPath`.

---

## Cross-Platform Builds (ARM vs amd64)

If you develop on an Apple Silicon Mac and deploy to an amd64 VPS, build for the target platform explicitly:

```bash
# Build for amd64 (Linux VPS target)
docker compose build --platform linux/amd64

# Or add platform to docker-compose.yml per service:
# platform: linux/amd64
```

Without this, you may see `exec format error` when running the image on a different architecture.

---

## Staging Checklist

- [ ] `PUBLIC_API_URL=http://ocr-lab-server:3001` in `.env` (container name, not localhost)
- [ ] `ORIGIN=http://<staging-ip>:3000` in `.env` (prevents CSRF 403)
- [ ] `PORT=3000` set in frontend `environment:` in `docker-compose.yml` (server reads `PORT=3001` from `.env`)
- [ ] `BODY_SIZE_LIMIT=Infinity` in `.env` (passed to both services via `env_file:`)
- [ ] Ports 3000 and 3001 open in firewall / security group
- [ ] `docker compose up --build -d` completes without error
- [ ] `docker compose ps` shows both services as `healthy` / `running`
- [ ] `curl http://localhost:3001/api/health` returns `{"status":"ok","workerReady":true}`
- [ ] Upload a **large** test image (>512KB) at `http://<staging-ip>:3000` and confirm OCR result (validates BODY_SIZE_LIMIT)
- [ ] Upload test image with non-English language to confirm Tesseract CDN access works

---

## Known Gotchas

### 1. PORT variable conflict

Both services read `PORT` from the environment. adapter-node (frontend) reads `PORT` to decide which port to listen on — it does **not** read `FRONTEND_PORT`. Since both services share the same `.env` file, the frontend overrides `PORT=3000` via `environment:` in `docker-compose.yml`. The server uses `.env`'s `PORT=3001` directly.

**Symptom if missed:** Frontend starts on port 3001 (same as server), or server starts on 3000.

### 2. BODY_SIZE_LIMIT default (512KB)

adapter-node defaults to a 512KB body size limit. The OCR server accepts 10MB images, but if the frontend rejects the upload first, users see a generic error.

**Symptom if missed:** Large image uploads fail with a 413 error from the frontend container, never reaching the backend.

**Fix:** Set `BODY_SIZE_LIMIT=Infinity` in `.env` (passed to both services via `env_file:`). The backend enforces the 10MB limit via `maxRequestBodySize` and the `validateImage` middleware.

### 3. Bun workspace resolution during Docker build

`bun install` requires ALL `packages/*/package.json` files to be present — even packages you're not building — because the root `package.json` declares `"packages": ["packages/*"]` as workspaces. If any workspace manifest is missing, `bun install` fails.

**Symptom if missed:** `bun install --frozen-lockfile` exits with "workspace package not found" error.

### 4. Healthcheck validates worker readiness (not just HTTP 200)

The healthcheck command validates BOTH the HTTP response status AND the `workerReady` field in the JSON body. `/api/health` always returns HTTP 200 — even when the Tesseract worker hasn't initialized. Without the body check, the frontend could start before the server is truly ready.

**Symptom if missed:** Frontend starts immediately but receives API errors from the server during the first few OCR requests (while the worker finishes loading).

**Verify manually:**
```bash
docker compose exec ocr-lab-server bun -e "const r = await fetch('http://localhost:3001/api/health'); const j = await r.json(); if(!r.ok || !j.workerReady) process.exit(1)"
```

### 5. Tesseract.js CDN access

The server container must have outbound internet access to `cdn.jsdelivr.net` on first OCR request (or startup). Language data (~5MB per language) is downloaded and cached in memory.

**Symptom if missed:** First OCR request hangs or times out with a network error.

### 6. Memory limit for Tesseract.js

The server container is limited to 1G memory. Tesseract.js loads language data (~5MB per language) and runs a WASM-based OCR engine, which can spike memory usage during processing — especially with large images or multi-language jobs.

**Symptom if missed:** Container gets OOM-killed during OCR processing of large images, or when processing multiple concurrent requests.

**Fix:** Monitor memory usage with `docker stats` and adjust the memory limit in `docker-compose.yml` under `deploy.resources.limits.memory` if needed. Consider setting `swap: 512m` to allow some swap headroom on disk-backed VPS instances.

---

## See Also

- [Deployment guide (PM2)](../deployment.md) — bare-metal setup reference
- [Docker common issues](../troubleshooting/docker-common-issues.md) — troubleshooting reference
- [Tailwind CSS production issue](../troubleshooting/tailwind-css-not-loading.md) — applies to both PM2 and Docker
