# OCR Lab — Deployment Guide

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

1. Set `PUBLIC_API_URL` to `http://localhost:3001` (frontend calls API server-side, so localhost is correct even on staging)
2. Set `BUN_PATH` to the bun path on the staging server
3. Ensure ports 3000 and 3001 are open in the firewall
4. Run `pm2 save && pm2 startup` on the staging server

## Architecture

```
Browser → http://<IP>:3000 (SvelteKit SSR)
                │
                └─ server-side fetch → http://localhost:3001 (Hono API)
                                              │
                                              └─ Tesseract.js worker (single instance)
```

- **Frontend** (port 3000): SvelteKit with `adapter-node`, renders SSR pages
- **Server** (port 3001): Hono API running on Bun, handles OCR processing
- No CORS needed — frontend calls API via server-side fetch

## Troubleshooting

### Server crashes on startup

Check logs: `pm2 logs ocr-lab-server --lines 50`

Common causes:
- **Module not found**: PM2 is using Node instead of Bun. Ensure `BUN_PATH` in `.env` points to the correct bun binary and `exec_mode: "fork"` is set in `ecosystem.config.cjs`.
- **Worker init failure**: Tesseract.js needs network access to download language data on first run, or a local `.traineddata` file.

### Frontend returns 500 on form submit

The frontend's server-side fetch to the API is failing. Check:
- Server is running: `curl http://localhost:3001/api/health`
- `PUBLIC_API_URL` in `.env` is correct

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

**Verify:** Check that `build/client/_app/immutable/assets/*.css` exists, then confirm the HTML response contains a `<link>` to it:

```bash
curl -s http://localhost:3000 | grep 'stylesheet'
# Expected: <link href="./_app/immutable/assets/0.<hash>.css" rel="stylesheet">
```
