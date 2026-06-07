# OCR Lab — Deployment Guide

Two deployment paths:

- **[Docker Compose](#docker-deployment)** — containerized, recommended
- **[PM2 (native)](#prerequisites)** — runs directly on the host

## Docker Deployment

> **Status: applied 2026-06-07.** Docker hardening from `docs/troubleshooting/docker-hardening-plan.md`.

### Environment files (split per service)

Env files are split per service so server and frontend don't leak config into each other and `PORT` can't collide:

| File | Used by | Copy from |
|------|---------|-----------|
| `.env.server` | `ocr-lab-server` (`env_file`) | `.env.server.example` |
| `.env.frontend` | `ocr-lab-frontend` (`env_file`) | `.env.frontend.example` |
| `.env` (root) | docker compose `${VAR}` interpolation only | — |

```bash
cp .env.server.example .env.server
cp .env.frontend.example .env.frontend
# edit .env.frontend: set ORIGIN and CSRF_TRUSTED_ORIGINS to your public URL
```

**`PORT` is intentionally absent from both env files** — `docker-compose.yml` sets it per service (`PORT=3001` server, `PORT=3000` frontend). Do not add it back; a shared `PORT` in a single env file previously caused a hidden collision where the frontend only worked because a compose override masked it.

### Build-time vs runtime variables

Two different mechanisms — do not confuse them:

| Mechanism | Source | Used for |
|-----------|--------|----------|
| Compose `${VAR}` interpolation | root `.env` (auto-loaded) or shell | `CSRF_TRUSTED_ORIGINS` build arg, optional `TAG` image tag |
| `env_file:` injection | `.env.server` / `.env.frontend` | everything the running container reads |

`CSRF_TRUSTED_ORIGINS` is needed in **both** places:

1. **Build time** (root `.env` or shell) — `svelte.config.js` reads it during `vite build` and bakes it into `csrf.trustedOrigins`. The compose build arg uses fail-fast syntax (`${CSRF_TRUSTED_ORIGINS:?...}`) so the build errors loudly instead of silently producing a broken bundle.
2. **Runtime** (`.env.frontend`) — adapter-node origin checks.

`ORIGIN` is runtime-only (`.env.frontend`).

### Network topology

```
Internet → reverse proxy (nginx/caddy, TLS) → 127.0.0.1:3000 (frontend)
                                                    │
                                   ocr-net (internal docker network)
                                                    │
                                    http://ocr-lab-server:3001 (API)
```

- **Frontend** publishes `127.0.0.1:3000:3000` — localhost only. A reverse proxy is **required** for external access.
- **Server** publishes nothing (`expose: 3001` only) — reachable solely over the internal `ocr-net` network as `http://ocr-lab-server:3001` (`PUBLIC_API_URL` in `.env.frontend`).

### Build and run

```bash
docker compose build
docker compose up -d
docker compose ps          # wait for both services healthy
```

Server healthcheck has `start_period: 60s` — first start downloads tesseract WASM/traineddata after the HTTP server is already listening, and the healthcheck requires `workerReady: true`. Don't panic if it reports `starting` for up to a minute.

### Hardening applied (docker-compose.yml)

| Setting | Why |
|---------|-----|
| `mem_limit` / `mem_reservation` | Real, enforced limits (Compose v2 also honors `deploy.resources.limits.memory`; the swap was for clarity/portability and to add a reservation). |
| `init: true` | PID-1 signal forwarding + zombie reaping |
| `cap_drop: ALL`, `no-new-privileges` | Minimal capabilities; blocks privilege escalation |
| `logging.options.max-size/max-file` | Log rotation (10 MB × 3) |
| `127.0.0.1` port binding / `expose` | No services on public interfaces |
| Base images pinned by digest | Reproducible builds, no silent base drift |
| `image: ocr-lab/*:${TAG:-dev}` | Named images for rollback/promotion (`TAG=v1.2.3 docker compose build`) |

Not yet applied (follow-ups): `read_only: true` rootfs (needs tesseract cache-path testing), pre-baking traineddata into the server image.

### Verification checklist

```bash
docker compose config                    # valid, no warnings
docker compose ps                        # both healthy
docker inspect ocr-lab-ocr-lab-server-1 --format '{{.HostConfig.Memory}}'
                                         # 1073741824 — limit actually enforced
docker compose exec ocr-lab-server ls node_modules | grep @types
                                         # empty — dev deps pruned from image
curl -s http://127.0.0.1:3000 | head -1  # frontend serves (localhost only)
# functional: upload an image through the frontend, expect OCR text back
```

### Updating images

```bash
git pull
docker compose build
docker compose up -d     # recreates changed containers
```

Base images are digest-pinned in the Dockerfiles (`oven/bun:1@sha256:…` = bun 1.3.14, `node:20-alpine@sha256:…` = node v20.20.2). To bump: `docker pull oven/bun:1`, grab the new digest from `docker images --digests`, update both Dockerfiles.

---

# PM2 Deployment (native)

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | v1.3+ | `curl -fsSL https://bun.sh/install \| bash` |
| Node.js | v20+ | Via [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm) |
| PM2 | v5+ | `npm install -g pm2` |

## Setup

### 1. Clone and install

```bash
git clone <repo-url> ocr-lab
cd ocr-lab/ts
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` to match your environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Hono API server port |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` for public access) |
| `OCR_DEFAULT_LANG` | `eng` | Default OCR language |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `20` | Max requests per window per IP |
| `PUBLIC_API_URL` | `http://localhost:3001` | API URL the frontend calls (server-side only) |
| `FRONTEND_PORT` | `3000` | SvelteKit frontend port |
| `ORIGIN` | _(empty)_ | SvelteKit adapter-node origin — set to the URL users access in the browser (e.g. `http://your-ip:3000`). Prevents CSRF 403 errors caused by `adapter-node` defaulting protocol to `https` |
| `CSRF_TRUSTED_ORIGINS` | _(empty)_ | Comma-separated list of additional origins to allow via SvelteKit's `csrf.trustedOrigins` config. Any origin in this list will pass the CSRF check even if it doesn't match `ORIGIN`. Useful when the app is accessed from multiple addresses (e.g. `http://localhost:3000,http://127.0.0.1:3000,http://<vps-ip>:3000`). **Must be set at build time** (baked into the SvelteKit build). |
| `BUN_PATH` | `bun` | Full path to bun binary (set if bun isn't in PM2's PATH) |

**Finding your bun path:**

```bash
which bun
# e.g. /home/user/.bun/bin/bun
```

Set `BUN_PATH` in `.env` if PM2 can't find bun (common when bun is installed per-user).

### 3. Build frontend

```bash
bun run build:frontend
```

### 4. Start with PM2

```bash
bun run start:pm2
```

### Redeploying after changes

After pulling new code and rebuilding, you **must restart the PM2 process** — PM2 keeps the old Node process alive serving stale build artifacts from memory:

```bash
git pull
bun run build:frontend
pm2 restart ocr-lab-frontend
```

Verify the new build is live by checking for updated asset hashes in the HTML response:

```bash
curl -s http://localhost:3000 | grep '_app/immutable'
```

**After changing `.env` config:** Delete and re-launch (restart does not reload env):

```bash
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 flush      # clear stale log artifacts
```

### 5. Verify

```bash
curl http://localhost:3001/api/health
# { "status": "ok", "workerReady": true, "uptime": ... }

curl http://localhost:3000
# HTML response
```

Save the process list so PM2 restores on reboot:

```bash
pm2 save
pm2 startup  # follow the output to enable auto-start
```

## PM2 Commands

| Command | Description |
|---------|-------------|
| `bun run start:pm2` | Start both processes |
| `bun run stop:pm2` | Stop both processes |
| `bun run restart:pm2` | Restart both processes |
| `bun run logs:pm2` | Tail logs for both processes |
| `pm2 list` | Show process status |
| `pm2 monit` | Real-time monitoring |
| `pm2 logs ocr-lab-server` | Tail server logs only |
| `pm2 logs ocr-lab-frontend` | Tail frontend logs only |

## Logs

Logs are written to `logs/` in the project root:

| File | Content |
|------|---------|
| `logs/server-out-0.log` | Server stdout |
| `logs/server-error-0.log` | Server stderr |
| `logs/frontend-out-1.log` | Frontend stdout |
| `logs/frontend-error-1.log` | Frontend stderr |

## Staging Server Checklist

Same steps as above. The only differences are in `.env`:

1. **Set `ORIGIN`** to the URL users access the app at, e.g. `http://103.41.206.197:3000`. This is required for SvelteKit's CSRF protection to work over plain HTTP (adapter-node defaults protocol to `https`).
2. **Set `CSRF_TRUSTED_ORIGINS`** to include all valid access URLs (e.g. `http://localhost:3000,http://127.0.0.1:3000,http://103.41.206.197:3000`). **Must be set at build time** — run `CSRF_TRUSTED_ORIGINS=... bun run build:frontend`.
3. Set `PUBLIC_API_URL` to `http://localhost:3001` (frontend calls API server-side, so localhost is correct even on staging)
4. Set `BUN_PATH` to the bun path on the staging server
5. Ensure ports 3000 and 3001 are open in the firewall
6. Run `pm2 save && pm2 startup` on the staging server

## Architecture

```
Browser → http://<IP>:3000 (SvelteKit SSR)
                │
                └─ server-side fetch → http://localhost:3001 (Hono API)
                                              │
                                              └─ Tesseract.js worker (single instance)
```

- **Frontend** (port 3000): SvelteKit with `adapter-node`, renders SSR pages using a custom design system (warm cream canvas, Cursor Orange CTAs, editorial typography). See `ts/DESIGN.md` for the full design specification.
- **Server** (port 3001): Hono API running on Bun, handles OCR processing
- No CORS needed — frontend calls API via server-side fetch

## Troubleshooting

### Server crashes on startup

Check logs: `pm2 logs ocr-lab-server --lines 50`

Common causes:
- **Module not found**: PM2 is using Node instead of Bun. Ensure `BUN_PATH` in `.env` points to the correct bun binary and `exec_mode: "fork"` is set in `ecosystem.config.cjs`.
- **Worker init failure**: Tesseract.js needs network access to download language data on first run, or a local `.traineddata` file.

### Frontend returns 403 on form submit (or "Cross-site POST form submissions are forbidden")

SvelteKit's adapter-node CSRF check compares the browser's `Origin` header against the `ORIGIN` env var. If they don't match and the origin isn't in `csrf.trustedOrigins`, the POST is rejected with 403.

The most common scenario: `ORIGIN` is set to `http://localhost:3000` but the browser accesses the app via a LAN IP (e.g. `http://192.168.1.50:3000`).

**Fix — two layers of defense:**

1. **Set `ORIGIN`** in `.env` to the exact URL users access the app at, e.g. `ORIGIN=http://your-server-ip:3000`. This is the primary origin the server expects.

2. **Set `CSRF_TRUSTED_ORIGINS`** at build time to allow additional origins. This is read by `svelte.config.js` and baked into `csrf.trustedOrigins` — any origin in this list will pass the CSRF check even without matching `ORIGIN`:

   ```bash
   CSRF_TRUSTED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://your-server-ip:3000" bun run build:frontend
   ```

   This ensures the app works regardless of which URL users access it from, without disabling CSRF protection for untrusted origins.

### Frontend returns 500 on form submit

The frontend's server-side fetch to the API is failing. Check:
- Server is running: `curl http://localhost:3001/api/health`
- `PUBLIC_API_URL` in `.env` is correct
- **After a config change:** Did you delete and re-launch PM2? `pm2 restart` does **not** reload env vars — use `pm2 delete all && pm2 start ecosystem.config.cjs`

### Port already in use

```bash
ss -tlnp | grep -E '3000|3001'
pm2 delete all
# kill the conflicting process, then:
bun run start:pm2
```

### PM2 not restoring after reboot

```bash
pm2 startup  # follow instructions to enable systemd service
pm2 save     # save current process list
```

### CSS not loading in production

Page renders but has no styles. Dev mode works fine.

**Cause 1 — Stale PM2 process:** PM2 is still running the old build. After rebuilding, restart the process:

```bash
bun run build:frontend
pm2 restart ocr-lab-frontend
```

**Cause 2 — Missing Tailwind configuration:** Tailwind CSS v4 + SvelteKit needs an explicit `+layout.svelte` with CSS import and `@source` directive in `app.css`. See `docs/troubleshooting/tailwind-css-not-loading.md`.

**Cause 3 — Tailwind v4 `max-w-*` utilities resolve to spacing scale:**
Named `max-w-*` utilities (`max-w-sm`, `max-w-md`, `max-w-lg`, etc.) now resolve to the custom `--spacing-*` scale instead of container widths. With `--spacing-lg: 24px`, `max-w-lg` becomes 24px — causing text to wrap word-by-word. Use arbitrary values like `max-w-[480px]` instead. See `docs/troubleshooting/tailwind-css-not-loading.md` for details.

**Verify:** Check that `build/client/_app/immutable/assets/*.css` exists, then confirm the HTML response contains a `<link>` to it:

```bash
curl -s http://localhost:3000 | grep 'stylesheet'
# Expected: <link href="./_app/immutable/assets/0.<hash>.css" rel="stylesheet">
```
