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

### Full variable reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Hono API bind port |
| `HOST` | `0.0.0.0` | Bind address (keep `0.0.0.0` inside container) |
| `OCR_DEFAULT_LANG` | `eng` | Default Tesseract language |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX_REQUESTS` | `20` | Max requests per IP per window |
| `PUBLIC_API_URL` | `http://ocr-lab-server:3001` | Server-side API fetch URL (use container name). **Note:** This URL is only resolvable from the frontend container via Docker DNS. Client-side JavaScript in the browser cannot resolve Docker service names and will fail if it attempts to use this URL directly. Keep all API calls server-side (SvelteKit form actions, server hooks). |
| `FRONTEND_PORT` | `3000` | SvelteKit SSR bind port |
| `ORIGIN` | `http://localhost:3000` | SvelteKit adapter-node origin — prevents CSRF 403 |

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
FRONTEND_PORT=3000

# SvelteKit adapter-node origin — must match the URL users access in the browser
# Prevents CSRF 403 errors. Replace with your server IP or domain.
ORIGIN=http://REPLACE_WITH_YOUR_IP:3000
```

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

**Key decisions:**
- Build context is the **monorepo root** (set in `docker-compose.yml`) so `packages/shared/` is accessible.
- Tesseract.js downloads language data from the jsdelivr CDN at runtime (requires outbound internet access).
- Runs as non-root user (`bun`) for security.
- Exposes port `3001`.

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

**Key decisions:**
- Only the compiled `packages/frontend/build/` directory is copied to the final stage — source files and devDependencies are excluded. The build output is fully self-contained.
- Runs as non-root user (`node`) for security.
- Exposes port `3000`.

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
      test: ["CMD", "bun", "-e", "const r = await fetch('http://localhost:3001/api/health'); if(!r.ok) process.exit(1)"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          memory: 512M

  ocr-lab-frontend:
    build:
      context: .                        # monorepo root
      dockerfile: packages/frontend/Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
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

# Frontend build output (rebuilt inside image)
packages/frontend/build/

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

> **Note:** Tesseract trained data files are not needed in the Docker build context. Tesseract.js downloads language data from the jsdelivr CDN at runtime.

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

- [ ] `PUBLIC_API_URL=http://ocr-lab-server:3001` (container name, not localhost)
- [ ] `ORIGIN=http://<staging-ip>:3000` (prevents CSRF 403)
- [ ] Ports 3000 and 3001 open in firewall / security group
- [ ] `docker compose up --build -d` completes without error
- [ ] `docker compose ps` shows both services as `healthy` / `running`
- [ ] `curl http://localhost:3001/api/health` returns `{"status":"ok","workerReady":true}`
- [ ] Upload test image at `http://<staging-ip>:3000` and confirm OCR result

---

## See Also

- [Deployment guide (PM2)](../deployment.md) — bare-metal setup reference
- [Docker common issues](../troubleshooting/docker-common-issues.md) — troubleshooting reference
- [Tailwind CSS production issue](../troubleshooting/tailwind-css-not-loading.md) — applies to both PM2 and Docker
