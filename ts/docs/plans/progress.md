# OCR Lab — Implementation Progress

**Started:** 2026-05-27
**Status:** Not started
**Current Phase:** —

---

## Phase Tracker

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Foundation | ⬜ Pending | — | — | — |
| 2. OCR API | ⬜ Pending | — | — | — |
| 3. SvelteKit Frontend | ⬜ Pending | — | — | — |
| 4. Production & Polish | ⬜ Pending | — | — | — |

---

## Phase 1: Foundation

**Goal:** Bun monorepo with running Hono server, health endpoint, and Tesseract.js worker service.

### Tasks

- [ ] Initialize Bun monorepo structure
  - [ ] Create `packages/server/`, `packages/frontend/`, `packages/shared/`
  - [ ] Configure root `package.json` with workspaces + catalogs
  - [ ] Create individual `package.json` for each workspace
  - [ ] Configure `tsconfig.json` for root + each package
- [ ] Install dependencies via `bun install`
  - [ ] Server: `hono`, `@hono/zod-validator`, `zod`, `tesseract.js`, `shared@workspace:*`
  - [ ] Frontend: `@sveltejs/kit`, `@sveltejs/adapter-node`, `svelte`, `shared@workspace:*`
  - [ ] Shared: export types
- [ ] Create shared types (`packages/shared/src/types.ts`)
  - [ ] `OCRResult` interface
  - [ ] `HealthResponse` interface
  - [ ] `OCR_LANGUAGES` constant
- [ ] Create Hono server entry (`packages/server/src/index.ts`)
  - [ ] `Bun.serve()` with `app.fetch`
  - [ ] `maxRequestBodySize` config
  - [ ] Graceful shutdown handler
- [ ] Implement Tesseract.js worker service (`packages/server/src/services/ocr.ts`)
  - [ ] `initWorker()` — initialize on startup
  - [ ] `recognizeImage(image: File, lang: string)` — process image
  - [ ] `terminateWorker()` — cleanup on shutdown
- [ ] Add GET `/api/health` endpoint
  - [ ] Returns `{ status, workerReady, uptime }`
- [ ] Write tests
  - [ ] Unit: OCR service (mocked worker)
  - [ ] Integration: health endpoint

### Acceptance Criteria

- [ ] `bun install` succeeds
- [ ] Server starts on `0.0.0.0:3001`
- [ ] `GET /api/health` returns `{ status: "ok", workerReady: true }`
- [ ] `bun test` passes
- [ ] `bun typecheck` passes

---

## Phase 2: OCR API

**Goal:** Working POST `/api/ocr` endpoint with validation and error handling.

### Tasks

- [ ] Implement POST `/api/ocr` route (`packages/server/src/routes/ocr.ts`)
- [ ] Add Zod schema validation for FormData
- [ ] Add file type validation middleware (`packages/server/src/middleware/validate-image.ts`)
  - [ ] Accept: PNG, JPEG, GIF, BMP, WebP
  - [ ] Reject: non-image types
- [ ] Add body limit middleware (10MB max)
- [ ] Add IP-based rate limiting middleware (`packages/server/src/middleware/rate-limit.ts`)
  - [ ] In-memory Map, keyed by IP
  - [ ] 20 requests per 60-second window
- [ ] Implement error responses
  - [ ] 400: No file / invalid type
  - [ ] 413: File too large
  - [ ] 429: Rate limit exceeded
  - [ ] 500: OCR processing failed
- [ ] Write tests
  - [ ] Integration: valid image → returns result
  - [ ] Integration: missing file → 400
  - [ ] Integration: file too large → 413
  - [ ] Integration: rate limit → 429
  - [ ] Integration: processing error → 500
  - [ ] E2E: real OCR on sample image

### Acceptance Criteria

- [ ] Valid image → returns `{ text, confidence, language, processingTimeMs }`
- [ ] Invalid request → returns appropriate error status + message
- [ ] Rate limit enforced at 20 req/min per IP
- [ ] All tests pass

---

## Phase 3: SvelteKit Frontend

**Goal:** SSR frontend with upload form, result display, and progressive enhancement.

### Tasks

- [ ] Initialize SvelteKit in `packages/frontend/` with `adapter-node`
- [ ] Create upload page (`packages/frontend/src/routes/+page.svelte`)
  - [ ] File input with drag-and-drop zone
  - [ ] Language selector dropdown (eng, chi_sim, jpn, kor, fra, deu, spa)
  - [ ] Submit button
- [ ] Implement form action (`packages/frontend/src/routes/+page.server.ts`)
  - [ ] Parse FormData
  - [ ] Call Hono API via `fetch('http://localhost:3001/api/ocr')`
  - [ ] Handle errors with `fail()`
  - [ ] Return result to page
- [ ] Create result display
  - [ ] Extracted text in `<pre>` block
  - [ ] Confidence score as percentage
  - [ ] Processing time display
  - [ ] Copy to clipboard button
- [ ] Add loading state during processing
- [ ] Add error message display
- [ ] Progressive enhancement: form works without JavaScript
- [ ] Style with CSS (minimal, clean)
- [ ] Write tests
  - [ ] Component: form action logic
  - [ ] Component: error handling

### Acceptance Criteria

- [ ] Page renders server-side
- [ ] Upload form submits via form action
- [ ] Result displays with text, confidence, copy button
- [ ] Works without JavaScript (progressive enhancement)
- [ ] All tests pass

---

## Phase 4: Production & Polish

**Goal:** Production-ready deployment on VPS with PM2.

### Tasks

- [ ] Configure PM2 (`ecosystem.config.js`)
  - [ ] Server process (Bun interpreter)
  - [ ] Frontend process (Node interpreter, built output)
  - [ ] Memory restart limit (500MB)
  - [ ] Log paths (`/var/log/ocr-lab/`)
- [ ] Configure environment variables for production
- [ ] Build SvelteKit frontend for production
- [ ] Test PM2 start/stop/restart
- [ ] Manual testing on VPS
- [ ] Write deployment documentation

### Acceptance Criteria

- [ ] App accessible via `http://<VPS_PUBLIC_IP>:3000`
- [ ] PM2 manages both server and frontend processes
- [ ] Auto-restart on crash or memory limit
- [ ] Logs written to `/var/log/ocr-lab/`

---

## Notes & Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-27 | Bun monorepo with workspaces | Clean separation, centralized deps via catalogs, workspace protocol |
| 2026-05-27 | Split architecture (Hono + SvelteKit) | Hono for API, SvelteKit for SSR — best of both worlds |
| 2026-05-27 | No CORS needed | SvelteKit calls Hono via server-side fetch only |
| 2026-05-27 | Single Tesseract worker | Deferred worker pool to future roadmap |

---

## Blockers

| Date | Blocker | Status | Resolution |
|------|---------|--------|------------|
| — | — | — | — |
