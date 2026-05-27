# OCR Lab — Product Requirements Document (PRD)

**Date:** 2026-05-27
**Status:** Approved — ready for implementation
**Version:** 1.1

---

## 0. Architecture Decision: Bun Monorepo Workspaces

This project uses Bun workspaces for a clean monorepo structure with three packages:

| Package | Path | Purpose |
|---------|------|---------|
| `server` | `packages/server/` | Hono backend API (port 3001) |
| `frontend` | `packages/frontend/` | SvelteKit SSR frontend (port 3000) |
| `shared` | `packages/shared/` | Shared TypeScript types |

**Key patterns:**
- Root `package.json` defines `workspaces: ["packages/*"]` and `catalog` for centralized dependency versions
- Internal packages referenced via `workspace:*` protocol
- No CORS needed — SvelteKit form actions call Hono via server-side `fetch()`
- PM2 manages both `server` and `frontend` as separate processes

---

## 1. Product Overview

OCR Lab is a web application that extracts text from images using Optical Character Recognition. Users anonymously upload an image and immediately receive the extracted text — no account, no persistence, no friction.

### 1.1 Problem Statement

Users need to quickly extract text from images (screenshots, scanned documents, photos of text) without installing software, creating accounts, or waiting for complex workflows.

### 1.2 Solution

A minimal, fast, server-side OCR web app:
- Upload an image → get text back instantly
- No authentication, no storage, no tracking
- Works on any device with a browser
- Runs on a VPS, accessible via public IP

### 1.3 Target Users

- Anyone who needs quick text extraction from images
- Developers, researchers, students, office workers
- Users who value privacy (anonymous, no data retained)

---

## 2. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|-----------|
| US-1 | User | Upload an image via file picker | I can extract text from any image on my device |
| US-2 | User | Drag and drop an image onto the page | I can upload faster without clicking through dialogs |
| US-3 | User | See the extracted text immediately after upload | I don't have to wait or refresh |
| US-4 | User | Copy the extracted text to clipboard | I can paste it into my workflow |
| US-5 | User | Select the OCR language | I can extract text in languages other than English |
| US-6 | User | See the confidence score of the extraction | I can judge if the result is reliable |
| US-7 | User | Use the app without creating an account | I can get results quickly without friction |
| US-8 | User | See a loading indicator during processing | I know the app is working on my request |
| US-9 | User | Get a clear error message if something fails | I understand what went wrong and how to fix it |

---

## 3. Functional Requirements

### 3.1 Image Upload

| ID | Requirement | Priority |
|----|------------|----------|
| FR-1 | Accept image files via file picker | P0 |
| FR-2 | Accept image files via drag-and-drop | P0 |
| FR-3 | Support PNG, JPEG, GIF, BMP, WebP formats | P0 |
| FR-4 | Reject files larger than 10MB | P0 |
| FR-5 | Reject non-image file types | P0 |
| FR-6 | Show image preview before submission | P1 |

### 3.2 OCR Processing

| ID | Requirement | Priority |
|----|------------|----------|
| FR-7 | Extract text from uploaded image using Tesseract.js | P0 |
| FR-8 | Default OCR language: English (eng) | P0 |
| FR-9 | Support language selection: eng, chi_sim, jpn, kor, fra, deu, spa | P0 |
| FR-10 | Return confidence score with results | P0 |
| FR-11 | Return processing time with results | P1 |

### 3.3 Result Display

| ID | Requirement | Priority |
|----|------------|----------|
| FR-12 | Display extracted text in a readable format | P0 |
| FR-13 | Display confidence score as percentage | P0 |
| FR-14 | Provide "Copy to Clipboard" button | P0 |
| FR-15 | Show loading state during OCR processing | P0 |
| FR-16 | Show error messages for failed processing | P0 |

### 3.4 Error Handling

| ID | Requirement | Priority |
|----|------------|----------|
| FR-17 | Show 400 error for missing/invalid file | P0 |
| FR-18 | Show 413 error for file too large | P0 |
| FR-19 | Show 429 error for rate limit exceeded | P1 |
| FR-20 | Show 500 error for server processing failure | P0 |

---

## 4. Non-Functional Requirements

| ID | Requirement | Target |
|----|------------|--------|
| NFR-1 | Server-side rendering (SSR) for initial page load | < 1s |
| NFR-2 | OCR processing time for standard image | < 5s |
| NFR-3 | Max concurrent requests (single worker) | 1 at a time, queue rest |
| NFR-4 | Rate limiting | 20 requests per minute per IP |
| NFR-5 | Max file size | 10MB |
| NFR-6 | No data persistence | Images discarded after processing |
| NFR-7 | Privacy | No tracking, no analytics, no logs of uploaded content |
| NFR-8 | Accessibility | WCAG 2.1 AA compliant |
| NFR-9 | Progressive enhancement | Works without JavaScript (form submission fallback) |

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Bun | v1.3+ |
| Backend API | Hono | v4+ |
| Frontend Framework | SvelteKit | v2+ (Svelte 5 runes) |
| CSS Framework | Tailwind CSS | v4+ |
| Build Tool | Vite | v6+ |
| SSR Adapter | @sveltejs/adapter-node | latest |
| OCR Engine | Tesseract.js | v7 |
| Validation | Zod + @hono/zod-validator | latest |
| Process Manager | PM2 | latest |
| Testing | bun test | built-in |

### 5.2 Project Structure

```
ocr-lab/ts/
├── package.json                      # Root workspace config + catalogs
├── tsconfig.json                     # Root TS config
├── ecosystem.config.js               # PM2 configuration
│
├── packages/
│   ├── server/                       # Hono backend (port 3001)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Bun.serve() entry point
│   │       ├── routes/
│   │       │   ├── health.ts         # GET /api/health
│   │       │   └── ocr.ts            # POST /api/ocr
│   │       ├── middleware/
│   │       │   ├── rate-limit.ts     # IP-based rate limiting
│   │       │   └── validate-image.ts # File type + size validation
│   │       ├── services/
│   │       │   └── ocr.ts            # Tesseract.js worker management
│   │       └── tests/
│   │           ├── ocr.test.ts       # Unit tests (mocked worker)
│   │           └── api.test.ts       # Integration tests
│   │
│   ├── frontend/                     # SvelteKit frontend (port 3000)
│   │   ├── package.json
│   │   ├── svelte.config.js          # adapter-node
│   │   ├── vite.config.ts            # SvelteKit + Tailwind v4 plugins
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── +page.svelte      # Upload UI (Tailwind CSS)
│   │       │   ├── +page.server.ts   # Form action → calls Hono API
│   │       │   └── +page.server.test.ts
│   │       ├── lib/
│   │       │   └── api.ts            # Typed API client
│   │       ├── app.html
│   │       ├── app.css               # @import "tailwindcss"
│   │       └── app.d.ts              # SvelteKit ambient types
│   │
│   └── shared/                       # Shared types
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── types.ts              # OCRResult, HealthResponse, etc.
│
├── docs/
│   └── plans/
│       ├── prd.md                    # This document
│       └── progress.md               # Implementation tracking
│
├── package.json                      # Root workspace config
└── tsconfig.json                     # Root TS config
```

### 5.3 Data Flow

```
Browser (SvelteKit SSR)
  │
  ├── Upload Form (drag-drop / file picker)
  │     │
  │     ▼
  │  Form Action → POST /api/ocr (multipart/form-data)
  │     │
  │     ▼
  │  Hono Backend (Bun.serve, port 3001)
  │     ├── Rate limit check (IP-based)
  │     ├── Body limit check (10MB)
  │     ├── Validate file type (image/*)
  │     ├── Extract File from FormData
  │     ├── Send to Tesseract.js worker
  │     └── Return { text, confidence, language, processingTimeMs }
  │     │
  │     ▼
  │  Display Result (text, confidence, copy button)
  │
  └── Tesseract.js Worker (single, reused across requests)
```

### 5.4 API Specification

#### POST `/api/ocr`

Extract text from an uploaded image.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `image` (File, required): Image file (PNG, JPEG, GIF, BMP, WebP)
  - `language` (string, optional): OCR language code (default: `eng`)

**Response (200):**
```json
{
  "text": "Extracted text content...",
  "confidence": 94.5,
  "language": "eng",
  "processingTimeMs": 1250
}
```

**Error Responses:**
| Status | Condition | Response |
|--------|-----------|----------|
| 400 | No file or invalid type | `{ "error": "No image provided" }` |
| 413 | File > 10MB | `{ "error": "File too large" }` |
| 429 | Rate limit exceeded | `{ "error": "Too many requests" }` |
| 500 | OCR processing failed | `{ "error": "OCR processing failed" }` |

#### GET `/api/health`

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "workerReady": true,
  "uptime": 3600
}
```

---

## 6. Configuration

### 6.1 Environment Variables

```env
# Server
PORT=3001
HOST=0.0.0.0
OCR_DEFAULT_LANG=eng
OCR_MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20

# Frontend (SvelteKit)
PUBLIC_API_URL=http://<VPS_PUBLIC_IP>:3001
FRONTEND_PORT=3000
ORIGIN=http://<VPS_PUBLIC_IP>:3000
```

### 6.2 PM2 Configuration (`ecosystem.config.cjs`)

```js
module.exports = {
  apps: [{
    name: 'ocr-lab-server',
    script: 'packages/server/src/index.ts',
    interpreter: '/path/to/bun',
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: '0.0.0.0',
      OCR_DEFAULT_LANG: 'eng',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX_REQUESTS: '20',
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    error_file: './logs/server-error.log',
    out_file: './logs/server-out.log',
  }, {
    name: 'ocr-lab-frontend',
    script: 'packages/frontend/build/index.js',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0',
      PUBLIC_API_URL: 'http://localhost:3001',
      ORIGIN: 'http://<VPS_PUBLIC_IP>:3000',
    },
    instances: 1,
    autorestart: true,
    error_file: './logs/frontend-error.log',
    out_file: './logs/frontend-out.log',
  }]
};
```

### 6.3 Package Scripts

```json
{
  "scripts": {
    "dev:server": "bun --hot packages/server/src/index.ts",
    "dev:frontend": "bun --filter frontend dev",
    "dev": "concurrently \"bun dev:server\" \"bun dev:frontend\"",
    "build:frontend": "bun --filter frontend build",
    "start:pm2": "pm2 start ecosystem.config.cjs",
    "stop:pm2": "pm2 stop ecosystem.config.cjs",
    "restart:pm2": "pm2 restart ecosystem.config.cjs",
    "logs:pm2": "pm2 logs",
    "test": "bun test --isolate",
    "test:watch": "bun test --isolate --watch",
    "typecheck": "bunx tsc --noEmit"
  }
}
```

---

## 7. TDD Strategy

### 7.1 Test Layers

| Layer | Scope | Method |
|-------|-------|--------|
| Unit | OCR service functions | Mock Tesseract.js worker |
| Integration | Hono API routes | `app.request()` with FormData |
| Component | SvelteKit form action | Mock fetch, test action logic |
| E2E | Full upload → OCR → result | Real Tesseract on sample image |

### 7.2 Red-Green-Refactor Sequence

1. Write failing unit test for OCR service (mocked worker)
2. Implement minimal OCR service to pass
3. Write failing integration test for Hono route
4. Implement minimal route to pass
5. Write failing test for SvelteKit form action
6. Implement minimal form action to pass
7. Write E2E test with real Tesseract on sample image
8. Refactor — extract shared types, add error handling, add UI

### 7.3 Test Fixtures

- `packages/server/tests/fixtures/sample.png` — small image with known text "Hello World"
- `packages/server/tests/fixtures/large.png` — image > 10MB for size limit testing
- `packages/server/tests/fixtures/invalid.txt` — non-image file for type validation

---

## 8. Implementation Phases

### Phase 1: Foundation

**Goal:** Bun monorepo with running Hono server, health endpoint, and Tesseract.js worker service.

- [ ] Initialize Bun monorepo structure (`packages/server`, `packages/frontend`, `packages/shared`)
- [ ] Configure root `package.json` with workspaces and catalogs
- [ ] Install dependencies via catalogs: `hono`, `tesseract.js`, `zod`, `@hono/zod-validator`
- [ ] Create shared types package (`packages/shared/src/types.ts`)
- [ ] Create Hono server entry (`packages/server/src/index.ts`)
- [ ] Implement Tesseract.js worker service (`packages/server/src/services/ocr.ts`)
  - `initWorker()`, `recognizeImage()`, `terminateWorker()`
- [ ] Add GET `/api/health` endpoint
- [ ] Write unit tests for OCR service (mocked worker)
- [ ] Write integration tests for health endpoint

**Acceptance Criteria:**
- Server starts on `0.0.0.0:3001`
- `/api/health` returns `{ status: "ok", workerReady: true }`
- Tests pass with `bun test`

---

### Phase 2: OCR API

**Goal:** Working POST `/api/ocr` endpoint with validation and error handling.

- [ ] Implement POST `/api/ocr` route (`packages/server/src/routes/ocr.ts`)
- [ ] Add Zod schema validation for form data
- [ ] Add file type validation middleware (`packages/server/src/middleware/validate-image.ts`)
- [ ] Add body limit middleware (10MB)
- [ ] Add IP-based rate limiting middleware (`packages/server/src/middleware/rate-limit.ts`)
- [ ] Implement error responses (400, 413, 429, 500)
- [ ] Write integration tests for all error cases
- [ ] Write E2E test with real OCR on sample image

**Acceptance Criteria:**
- Valid image → returns `{ text, confidence, language, processingTimeMs }`
- Invalid request → returns appropriate error status + message
- Rate limit enforced at 20 req/min per IP
- All tests pass

---

### Phase 3: SvelteKit Frontend

**Goal:** SSR frontend with upload form, result display, and progressive enhancement.

- [ ] Initialize SvelteKit in `packages/frontend/` with `adapter-node`
- [ ] Create upload page (`packages/frontend/src/routes/+page.svelte`)
  - File input with drag-and-drop zone
  - Language selector dropdown
  - Submit button
- [ ] Implement form action (`packages/frontend/src/routes/+page.server.ts`)
  - Parse FormData, call Hono API via `fetch('http://localhost:3001/api/ocr')`
  - Handle errors, return result
- [ ] Create result display component
  - Extracted text in `<pre>` block
  - Confidence score, processing time
  - Copy to clipboard button
- [ ] Add loading state during processing
- [ ] Add error message display
- [ ] Write component tests for form action
- [ ] Style with CSS (minimal, clean)

**Acceptance Criteria:**
- Page renders server-side
- Upload form submits via form action
- Result displays with text, confidence, copy button
- Works without JavaScript (progressive enhancement)
- All tests pass

---

### Phase 4: Production & Polish

**Goal:** Production-ready deployment on VPS with PM2.

- [ ] Configure PM2 (`ecosystem.config.js`)
- [ ] Configure environment variables for production
- [ ] Set up CORS for VPS public IP
- [ ] Bind server to `0.0.0.0`
- [ ] Build SvelteKit frontend for production
- [ ] Test PM2 start/stop/restart
- [ ] Add logging configuration
- [ ] Add memory restart limit (500MB)
- [ ] Write deployment documentation
- [ ] Manual testing on VPS

**Acceptance Criteria:**
- App accessible via `http://<VPS_PUBLIC_IP>:3000`
- PM2 manages both server and frontend processes
- Auto-restart on crash or memory limit
- Logs written to `/var/log/ocr-lab/`

---

## 9. Success Criteria

| Metric | Target |
|--------|--------|
| Page load time (SSR) | < 1 second |
| OCR processing time (standard image) | < 5 seconds |
| Accuracy on clean text images | > 90% confidence |
| Uptime (PM2 managed) | > 99% |
| Zero data persistence | Confirmed — no files stored |

---

## 10. Future Roadmap (Next Phase Notes)

### 10.1 Worker Pool (Deferred from Phase 1)

**Problem:** Single Tesseract.js worker can only process one request at a time. Concurrent requests queue up, increasing latency.

**Solution:** Implement a worker pool with configurable size:
- Create N workers on startup
- Route requests to available worker
- Queue requests when all workers busy
- Add health check for worker pool status

**Trigger:** Add when you see consistent queueing or > 2 concurrent users.

---

### 10.2 Image Preprocessing (Deferred from Phase 2)

**Problem:** Low-quality, skewed, or noisy images produce poor OCR results.

**Solution:** Add preprocessing pipeline before OCR:
- Auto-rotate (`rotateAuto: true` in Tesseract.js — already supported)
- Grayscale conversion
- Binarization (threshold-based)
- Deskew correction
- Noise reduction

**Libraries:** `sharp` for image manipulation, or canvas-based processing.

**Trigger:** Add when users report poor accuracy on scanned/noisy images.

---

### 10.3 Result Caching (Deferred from Phase 2)

**Problem:** Identical images processed multiple times waste CPU and increase latency.

**Solution:** Cache OCR results by image hash:
- Generate hash (SHA-256) of uploaded image
- Check cache before processing
- Return cached result if hit
- Set TTL for cache entries (e.g., 24 hours)

**Storage:** In-memory cache (Map) for single instance, Redis for multi-instance.

**Trigger:** Add when you see repeated uploads of same images or want to reduce server load.

---

### 10.4 Additional Future Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-language detection | Auto-detect image language | P2 |
| Batch upload | Process multiple images at once | P2 |
| Export formats | Download as .txt, .pdf, .docx | P2 |
| Image editing | Crop, rotate, enhance before OCR | P3 |
| API key authentication | Rate limit tiers for authenticated users | P3 |
| Usage analytics | Anonymous usage metrics (opt-in) | P3 |
| Dark mode | Theme toggle | P3 |
