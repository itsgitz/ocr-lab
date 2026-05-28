# OCR Lab — Implementation Progress

**Started:** 2026-05-27
**Status:** Complete
**Current Phase:** Phase 5 (Docker Containerization) — ✅ Complete

---

## Phase Tracker

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Foundation | ✅ Complete | 2026-05-27 | 2026-05-27 | Monorepo setup, Hono server, health endpoint, OCR service, tests |
| 2. OCR API | ✅ Complete | 2026-05-27 | 2026-05-27 | POST /api/ocr, validation middleware, rate limiting, error handling |
| 3. SvelteKit Frontend | ✅ Complete | 2026-05-27 | 2026-05-27 | Tailwind v4, Svelte 5 runes, progressive enhancement, 29 tests all passing |
| 4. Production & Polish | ✅ Complete | 2026-05-27 | 2026-05-27 | PM2 deployment verified on VPS (103.41.206.197), deployment docs written |
| 5. Docker Containerization | ✅ Complete | 2026-05-28 | 2026-05-28 | Multi-stage Dockerfiles, BuildKit caching, healthcheck w/ workerReady validation, Compose orchestration, all verified and cleaned up |

---

## Phase 1: Foundation

**Goal:** Bun monorepo with running Hono server, health endpoint, and Tesseract.js worker service.

### Tasks

- [x] Initialize Bun monorepo structure
  - [x] Create `packages/server/`, `packages/frontend/`, `packages/shared/`
  - [x] Configure root `package.json` with workspaces + catalogs
  - [x] Create individual `package.json` for each workspace
  - [x] Configure `tsconfig.json` for root + each package
- [x] Install dependencies via `bun install`
  - [x] Server: `hono`, `@hono/zod-validator`, `zod`, `tesseract.js`, `shared@workspace:*`
  - [x] Frontend: `@sveltejs/kit`, `@sveltejs/adapter-node`, `svelte`, `shared@workspace:*`
  - [x] Shared: export types
- [x] Create shared types (`packages/shared/src/types.ts`)
  - [x] `OCRResult` interface
  - [x] `HealthResponse` interface
  - [x] `OCR_LANGUAGES` constant
- [x] Create Hono server entry (`packages/server/src/index.ts`)
  - [x] `Bun.serve()` with `app.fetch`
  - [x] `maxRequestBodySize` config
  - [x] Graceful shutdown handler
- [x] Implement Tesseract.js worker service (`packages/server/src/services/ocr.ts`)
  - [x] `initWorker()` — initialize on startup
  - [x] `recognizeImage(image: File, lang: string)` — process image
  - [x] `terminateWorker()` — cleanup on shutdown
- [x] Add GET `/api/health` endpoint
  - [x] Returns `{ status, workerReady, uptime }`
- [x] Write tests
  - [x] Unit: OCR service (mocked worker)
  - [x] Integration: health endpoint

### Acceptance Criteria

- [x] `bun install` succeeds
- [x] Server starts on `0.0.0.0:3001`
- [x] `GET /api/health` returns `{ status: "ok", workerReady: true }`
- [x] `bun test` passes
- [x] `bun typecheck` passes

---

## Phase 2: OCR API

**Goal:** Working POST `/api/ocr` endpoint with validation and error handling.

### Tasks

- [x] Implement POST `/api/ocr` route (`packages/server/src/routes/ocr.ts`)
- [x] Add file type validation middleware (`packages/server/src/middleware/validate-image.ts`)
  - [x] Accept: PNG, JPEG, GIF, BMP, WebP
  - [x] Reject: non-image types
- [x] Add body limit (10MB max via `maxRequestBodySize` + middleware check)
- [x] Add IP-based rate limiting middleware (`packages/server/src/middleware/rate-limit.ts`)
  - [x] In-memory Map, keyed by IP (x-forwarded-for header)
  - [x] 20 requests per 60-second window (configurable via env)
- [x] Implement error responses
  - [x] 400: No file / invalid type
  - [x] 413: File too large
  - [x] 429: Rate limit exceeded
  - [x] 500: OCR processing failed
- [x] Write tests (TDD: red-green for each slice)
  - [x] Unit: rate limit middleware (4 tests)
  - [x] Unit: validate-image middleware (6 tests)
  - [x] Integration: OCR route — valid image → returns result
  - [x] Integration: OCR route — missing file → 400
  - [x] Integration: OCR route — invalid type → 400
  - [x] Integration: OCR route — file too large → 413
  - [x] Integration: OCR route — rate limit → 429
  - [x] Integration: OCR route — processing error → 500
  - [x] Integration: OCR route — language parameter passthrough

### Acceptance Criteria

- [x] Valid image → returns `{ text, confidence, language, processingTimeMs }`
- [x] Invalid request → returns appropriate error status + message
- [x] Rate limit enforced at 20 req/min per IP
- [x] All tests pass (23 tests, 5 files)
- [x] `bun run typecheck` passes

---

## Phase 3: SvelteKit Frontend

**Goal:** SSR frontend with upload form, result display, and progressive enhancement.

### Tasks

- [x] Initialize SvelteKit in `packages/frontend/` with `adapter-node`
  - [x] Create `svelte.config.js`, `vite.config.ts`, `tsconfig.json`
  - [x] Create `app.html`, `app.css` (Tailwind v4), `app.d.ts`
- [x] Create upload page (`packages/frontend/src/routes/+page.svelte`)
  - [x] File input with drag-and-drop zone (JS-enhanced, file picker fallback)
  - [x] Language selector dropdown (from shared `OCR_LANGUAGES`)
  - [x] Submit button with loading state
  - [x] Image preview before submission (JS-enhanced)
- [x] Implement form action (`packages/frontend/src/routes/+page.server.ts`)
  - [x] Parse FormData
  - [x] Call Hono API via `fetch('http://localhost:3001/api/ocr')`
  - [x] Handle errors with `fail()`
  - [x] Return result to page
- [x] Create result display
  - [x] Extracted text in `<pre>` block
  - [x] Confidence score as percentage
  - [x] Processing time display
  - [x] Copy to clipboard button (progressive enhancement — hidden without JS)
- [x] Add loading state during processing
- [x] Add error message display
- [x] Progressive enhancement: form works without JavaScript
- [x] Style with Tailwind CSS v4 (clean, minimal, responsive)
- [x] Write tests
  - [x] Unit: form action logic (mocked fetch)
  - [x] Unit: error handling (400, 413, 429, 500)

### Acceptance Criteria

- [x] Page renders server-side
- [x] Upload form submits via form action
- [x] Result displays with text, confidence, copy button
- [x] Works without JavaScript (progressive enhancement)
- [x] All 29 tests pass (6 files across server + frontend)

---

## Phase 4: Production & Polish

**Goal:** Production-ready deployment on VPS with PM2.

### Tasks

- [x] Configure PM2 (`ecosystem.config.cjs`)
  - [x] Server process (Bun interpreter, `packages/server/src/index.ts`)
  - [x] Frontend process (Node interpreter, `packages/frontend/build/index.js`)
  - [x] Memory restart limit (500MB)
  - [x] Log paths (project-local `logs/` directory)
  - [x] `.env` file loading (no dotenv dependency, portable across environments)
  - [x] `exec_mode: "fork"` for server (required — PM2 cluster mode ignores custom interpreter)
  - [x] `BUN_PATH` env var for portable bun binary resolution
- [x] Create `.env.example` with all environment variables documented
- [x] Build SvelteKit frontend for production (with `precompress: true`)
- [x] Run all tests and typecheck — 33 tests passing
- [x] Test PM2 start/stop/restart on VPS
- [x] Manual testing on VPS (103.41.206.197)
  - [x] `GET /api/health` → `{ "status": "ok", "workerReady": true }` via public IP
  - [x] `GET /` → SSR HTML with upload form via public IP
  - [x] PM2 restart verified — both processes recover cleanly
  - [x] PM2 process list saved (`pm2 save`)
- [x] Write deployment documentation (`docs/deployment.md`)

### Production Hardening

- [x] Rate limit store: periodic cleanup (every 60s via `startCleanupTimer`) to prevent memory leak
- [x] Rate limit IP detection: fallback chain `x-forwarded-for` → `x-real-ip` → `"unknown"`
- [x] OCR worker: reinitialize worker when language changes (`initWorker` terminates + recreates)

### Post-Deployment Fixes

- [x] Fix Tailwind CSS v4 not loading in production build
  - [x] Add `+layout.svelte` with explicit `import "../app.css"`
  - [x] Add `@source "./**/*.{svelte,ts,js}"` to `app.css`
  - [x] Rebuild and restart PM2 frontend process
  - [x] Write troubleshooting doc (`docs/troubleshooting/tailwind-css-not-loading.md`)
- [x] Fix CSRF 403 on form submit (SvelteKit adapter-node defaults protocol to `https`)
  - [x] Add `ORIGIN` env var to `.env` (set to `http://your-server-ip:3000`)
  - [x] Add `ORIGIN` to `.env.example` with documentation
  - [x] Wire `ORIGIN` through `ecosystem.config.cjs` → frontend process env
  - [x] Document in `docs/deployment.md` env table, staging checklist, and CSRF troubleshooting section

### Acceptance Criteria

- [x] App accessible via `http://103.41.206.197:3000`
- [x] PM2 manages both server and frontend processes
- [x] Auto-restart on crash or memory limit (500MB)
- [x] Logs written to `logs/` (project-local)

---

## Notes & Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-27 | Bun monorepo with workspaces | Clean separation, centralized deps via catalogs, workspace protocol |
| 2026-05-27 | Split architecture (Hono + SvelteKit) | Hono for API, SvelteKit for SSR — best of both worlds |
| 2026-05-27 | No CORS needed | SvelteKit calls Hono via server-side fetch only |
| 2026-05-27 | Single Tesseract worker | Deferred worker pool to future roadmap |
| 2026-05-27 | Direct middleware validation over Zod schemas | FormData validation is simpler with direct checks; Zod better suited for JSON body validation |
| 2026-05-27 | `bun test --isolate` as default | `mock.module()` leaks across test files without isolation |
| 2026-05-27 | Mock `tesseract.js` instead of `../src/services/ocr` in route tests | Avoids module path conflict with real OCR service tests |
| 2026-05-27 | Tailwind CSS v4 with `@tailwindcss/vite` plugin | No PostCSS config needed, native Vite integration |
| 2026-05-27 | SvelteKit `kit.alias` instead of tsconfig paths | Avoids conflict with SvelteKit's auto-generated tsconfig |
| 2026-05-27 | Frontend tests placed in `tests/` not `src/routes/` | SvelteKit reserves `+` prefix in routes directory |
| 2026-05-27 | Frontend excluded from root `tsc --noEmit` | SvelteKit uses its own type generation; root `tsc` doesn't understand `$lib` or `$types` |
| 2026-05-27 | Added `image/x-ms-bmp` to allowed types | Bun's FormData normalizes `image/bmp` to `image/x-ms-bmp` |
| 2026-05-27 | Deferred E2E test with real Tesseract | Integration tests with mocked OCR service cover all behaviors; E2E deferred to avoid test fixture management |
| 2026-05-27 | PM2 config uses `.cjs` extension | Root `package.json` has `"type": "module"`, so `.js` files are ESM; PM2 needs CJS for config |
| 2026-05-27 | Rate limit periodic cleanup via `startCleanupTimer(60000)` | Prevents stale entries in the in-memory `Map` from accumulating indefinitely |
| 2026-05-27 | IP detection chain: `x-forwarded-for` → `x-real-ip` → `unknown` | Ensures rate limiting works behind reverse proxies that set `x-real-ip` instead of `x-forwarded-for` |
| 2026-05-27 | OCR worker reinitializes on language change | `initWorker` now terminates and recreates the worker if the requested language differs from the current one |
| 2026-05-27 | PM2 `exec_mode: "fork"` for server process | PM2 cluster mode uses Node's `cluster` module internally, ignoring the custom `interpreter` field; fork mode is required for Bun |
| 2026-05-27 | Explicit `+layout.svelte` with `import "../app.css"` | SvelteKit's auto-detection of `src/app.css` is unreliable with `@tailwindcss/vite` plugin in production builds |
| 2026-05-27 | `@source` directive in `app.css` for Tailwind v4 | `@tailwindcss/vite` auto-detection doesn't find `.svelte` files through SvelteKit's build pipeline; explicit source paths required |
| 2026-05-27 | Always `pm2 restart` after `bun run build:frontend` | PM2 keeps the old Node process alive serving stale build artifacts; rebuild alone doesn't update the running app |
| 2026-05-27 | `.env` loading in `ecosystem.config.cjs` (no dotenv) | Lightweight custom parser keeps the config portable across environments without adding a dependency |
| 2026-05-27 | Project-local `logs/` instead of `/var/log/ocr-lab/` | No sudo required, portable across dev/staging environments |
| 2026-05-27 | `BUN_PATH` env var for PM2 interpreter | Bun installed per-user (`~/.bun/bin/bun`) isn't in PM2's default PATH; explicit path avoids silent fallback to Node |
| 2026-05-27 | `ORIGIN` env var for SvelteKit adapter-node | Adapter-node defaults protocol to `https` in `get_origin()`; without `ORIGIN`, CSRF check compares browser's `http://` origin against server's `https://` origin and returns 403. Setting `ORIGIN` to the actual HTTP access URL fixes the mismatch. |

---

---
## Phase 5: Docker Containerization

**Goal:** Production-ready Docker images for both services with multi-stage builds, security hardening, and local development orchestration.

**Plan reference:** [`docs/plans/docker.md`](docker.md)

### Tasks

- [x] Create `.env.docker.example` — Docker-specific env template (container names instead of localhost)
- [x] Create `packages/server/Dockerfile`
  - [x] Multi-stage: `deps` → `production`
  - [x] BuildKit cache mount for `bun install` (~/.bun/install/cache)
  - [x] Copy workspace manifests first for layer caching
  - [x] Non-root `bun` user
  - [x] Clean COPY syntax (no invalid shell operators)
- [x] Create `packages/frontend/Dockerfile`
  - [x] Three-stage: `deps` → `builder` → `production`
  - [x] BuildKit cache mount for `bun install`
  - [x] Build with `bun run build:frontend`, runtime on `node:20-alpine`
  - [x] Only compiled `build/` output copied to final stage
  - [x] Non-root `node` user
- [x] Create `.dockerignore`
  - [x] Excludes `node_modules/`, `build/`, `.svelte-kit/`, `logs/`, `.env`, `.git/`, `docs/`, `*.md`
- [x] Create `docker-compose.yml`
  - [x] Two services: `ocr-lab-server` (port 3001), `ocr-lab-frontend` (port 3000)
  - [x] Internal bridge network (`ocr-net`)
  - [x] Per-service `PORT` override (resolves shared `.env` conflict)
  - [x] `BODY_SIZE_LIMIT=Infinity` for frontend
  - [x] Healthcheck validates both HTTP status AND `workerReady` JSON field
  - [x] Frontend depends on server health (`condition: service_healthy`)
  - [x] 1G memory limit for server (Tesseract.js needs headroom)
  - [x] `restart: unless-stopped` for both services
- [x] Update `docs/plans/docker.md` with all implementation fixes
  - [x] BuildKit cache mounts documented
  - [x] COPY shell operator issue documented and fixed
  - [x] Healthcheck `workerReady` body validation documented
  - [x] `.svelte-kit/` exclusion rationale
  - [x] Memory limit rationale (1G for Tesseract.js)
- [x] Build and verify on VPS
  - [x] `docker compose build` succeeds for both images
  - [x] `docker compose up -d` — both containers start
  - [x] `docker compose ps` — both healthy/running
  - [x] `curl http://localhost:3001/api/health` — returns `{"status":"ok","workerReady":true}`
  - [x] `curl http://localhost:3000/` — returns HTTP 200, 3118 bytes SSR HTML
- [x] Destroy services and clean up
  - [x] `docker compose down --rmi all` — images, containers, network removed
  - [x] Restore original `.env` from backup

### Acceptance Criteria

- [x] Both images build without errors
- [x] Server container starts, reports healthy only when worker is ready
- [x] Frontend container waits for server health, then serves SSR HTML (3118 bytes)
- [x] All containers destroyed and images removed after verification (dev VPS policy)

### Notes & Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-28 | BuildKit cache mounts for `bun install` | Avoids re-downloading packages on repeated builds; critical for CI/CD iteration speed |
| 2026-05-28 | Healthcheck validates `workerReady` in JSON body | `/api/health` always returns HTTP 200 even when worker isn't ready; body check prevents false healthy status |
| 2026-05-28 | No shell operators in COPY instructions | `2>/dev/null || true` is invalid Dockerfile syntax (COPY is not a shell command) |
| 2026-05-28 | 1G memory limit for server | Tesseract.js uses WASM + language data; 512MB caused OOM risk under concurrent load |
| 2026-05-28 | Separate Dockerfiles per package | Monorepo context requires different build strategies (Bun runtime for server, Node for frontend); single Dockerfile would be overly complex |
| 2026-05-28 | `oven/bun:1` (Debian) not Alpine for server | Tesseract.js WASM compatibility is guaranteed on Debian; Alpine/musl may have edge cases |
| 2026-05-28 | `node:20-alpine` for frontend production | adapter-node output is plain Node.js; no Bun needed at runtime; Alpine keeps image slim |
| 2026-05-28 | No `COPY` for `packages/shared/node_modules` | Shared package has zero npm deps; `bun install` never creates this directory; COPY would fail with "not found" |

---

## Blockers

| Date | Blocker | Status | Resolution |
|------|---------|--------|------------|
| — | — | — | — |
