# Docker Setup Hardening — Findings & Implementation Plan

> Status: PLANNED — implementation drafted, then reverted pending review. Docs kept as spec.
> Date: 2026-06-07
>
> Dry-run results (from the reverted draft, still valid for implementation):
> - `docker compose config` clean with the new compose file (no swarm warnings)
> - Both images built successfully — confirms `bun install --frozen-lockfile --production`
>   resolves `workspace:*` for `shared` (H2 viable)
> - H3 deps-stage trim NOT viable: `bun install --frozen-lockfile` fails with
>   "lockfile had changes, but lockfile is frozen" when any workspace manifest is missing.
>   Frontend deps stage must keep `COPY packages/server/package.json` (manifest only).
> - Digest pins resolved 2026-06-07: oven/bun:1 (bun 1.3.14)
>   sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4,
>   node:20-alpine (node v20.20.2)
>   sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

## Background

Review of `packages/server/Dockerfile`, `packages/frontend/Dockerfile`, and `docker-compose.yml` against Docker best practices. Triggered by a suspected bug at `docker-compose.yml:32` (frontend `environment:` block "not reading from `.env`").

### Verdict on the original concern: NOT a bug

`${ORIGIN}` / `${CSRF_TRUSTED_ORIGINS}` in the `environment:` block **do** resolve from `.env`. Docker Compose auto-loads the project-root `.env` file as the interpolation source for `${VAR}` references inside the YAML itself. This is a separate mechanism from `env_file:`, which injects the file's lines directly into the container environment.

- Interpolation (`${VAR}` in YAML) ← root `.env` or shell (shell wins on conflict)
- `env_file: .env` ← injects all vars into the container
- Precedence inside the container: `environment:` > `env_file:`

So the values work — but the two interpolated lines are **redundant** (`env_file` already injects the same vars) and fragile: if interpolation ever resolves a var to empty (typo, unset shell override), the empty `environment:` value silently overrides the correct `env_file` value.

References:
- https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/
- https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/

## Findings (spec)

All verified against actual repo files, not speculation.

### Critical

| ID | Finding | Location |
|----|---------|----------|
| C1 | Whole `.env` injected into BOTH containers via `env_file: .env`. Server vars leak into frontend and vice versa. Hidden `PORT` collision: `.env` has `PORT=3001`; frontend only binds 3000 because the `environment: PORT=3000` literal overrides `env_file`. Remove that line and frontend tries to bind 3001. | `docker-compose.yml:8,31` |

### High

| ID | Finding | Location |
|----|---------|----------|
| H1 | `deploy.resources.limits.memory: 1G` is a Swarm-only directive — **ignored** by `docker compose up`. Server (tesseract.js, memory-heavy) has no enforced limit. | `docker-compose.yml:18-21` |
| H2 | Server production image ships devDependencies — `deps` stage installs everything, production stage copies `node_modules` wholesale. No `--production` prune. | `packages/server/Dockerfile:9-16` |
| H3 | Frontend `deps` stage copies all 4 package.json files → installs server deps (tesseract.js) in frontend build chain. Slow builds; server-dep churn busts frontend cache. | `packages/frontend/Dockerfile:4-7` |
| H4 | No healthcheck on frontend service. | `docker-compose.yml:23-41` |
| H5 | Floating base image tags (`oven/bun:1`, `node:20-alpine`) — non-reproducible builds, supply-chain drift. | both Dockerfiles |

### Medium

| ID | Finding | Location |
|----|---------|----------|
| M1 | Frontend has zero resource limits. SSR + unbounded body size = unbounded memory per upload. | `docker-compose.yml` |
| M2 | No `init: true` — no PID-1 zombie reaping (server has its own SIGTERM handler at `packages/server/src/index.ts:34-35`, frontend relies on adapter-node). | both services |
| M3 | No container hardening: missing `cap_drop: ALL`, `no-new-privileges`. (Non-root users already in place — good.) | both services |
| M4 | No log rotation — `json-file` logs grow unbounded. | both services |
| M5 | No `image:` names — auto-named `<dir>-<service>`, no tags for rollback/promotion. | both services |
| M6 | Server healthcheck `start_period: 15s` too short. Worker init fires async AFTER listen (`index.ts:38`) and downloads tesseract WASM/traineddata; healthcheck asserts `workerReady` → cold-start restart-loop risk. | `docker-compose.yml:17` |
| M7 | Ports bound to `0.0.0.0`. Server needs no host publishing at all — frontend reaches it via `http://ocr-lab-server:3001` on `ocr-net` (see `.env.docker.example:9`). | `docker-compose.yml:6-7,29-30` |

### Low

| ID | Finding | Location |
|----|---------|----------|
| L1 | `COPY packages/server/ packages/server/` ships non-runtime files (tsconfig etc.). | `packages/server/Dockerfile:18` |
| L2 | `ORIGIN` interpolates to empty string when unset → adapter-node CSRF 403 on form posts, silently. No fail-fast. | `docker-compose.yml:34` |
| L5 | Redundant `environment:` interpolation lines (the original question). | `docker-compose.yml:34-35` |

### Verified good (no action)

- `.dockerignore` exists, adequate coverage (node_modules, build, .svelte-kit, .env*, .git, docs, *.md)
- Non-root users in both images (`USER bun` / `USER node`)
- Server has SIGINT/SIGTERM handlers (`packages/server/src/index.ts:34-35`)
- `CSRF_TRUSTED_ORIGINS` build ARG is justified — consumed at build time in `packages/frontend/svelte.config.js:3`
- `PUBLIC_API_URL` correctly runtime-injected (read via `process.env` in `packages/frontend/src/lib/api.ts:3`)
- Absence of compose `version:` key is correct for the current spec

## Implementation plan

User decisions (confirmed):
- **Scope: all findings** (C+H+M+L), excluding `read_only` hardening (follow-up)
- **Frontend behind reverse proxy** → bind `127.0.0.1:3000:3000`

### Files to modify

1. `docker-compose.yml`
2. `packages/server/Dockerfile`
3. `packages/frontend/Dockerfile`
4. NEW: `.env.server.example`, `.env.frontend.example` (split from `.env.docker.example`)
5. `docs/deployment.md` — env-file split, build-time vs runtime vars, reverse-proxy requirement
6. `.gitignore` — add `.env.server`, `.env.frontend`

### 1. docker-compose.yml

**C1 — split env files:**
- `ocr-lab-server`: `env_file: .env.server`
- `ocr-lab-frontend`: `env_file: .env.frontend`
- Keep `PORT` OUT of both env files; set per-service via `environment:` literal.
- `.env.server.example`: HOST, OCR_DEFAULT_LANG, RATE_LIMIT_* (from `.env.docker.example`)
- `.env.frontend.example`: ORIGIN, CSRF_TRUSTED_ORIGINS, PUBLIC_API_URL, BODY_SIZE_LIMIT
- ⚠️ Operator action after merge: split local `.env` → `.env.server` + `.env.frontend`. Keep root `.env` (or shell) for compose interpolation vars (`CSRF_TRUSTED_ORIGINS` build arg, `TAG`).

**L5 — frontend environment block:**
```yaml
environment:
  - PORT=3000   # literal; keep — prevents PORT collision
# DROP: ORIGIN=${ORIGIN}, CSRF_TRUSTED_ORIGINS=${CSRF_TRUSTED_ORIGINS}
```

**L2 — fail-fast build arg:**
```yaml
build:
  args:
    - CSRF_TRUSTED_ORIGINS=${CSRF_TRUSTED_ORIGINS:?must be set in root .env or shell}
```

**H1/M1 — real memory limits (delete swarm-only `deploy:` block):**
```yaml
ocr-lab-server:
  mem_limit: 1g
  mem_reservation: 512m
ocr-lab-frontend:
  mem_limit: 512m
```

**M6 — server healthcheck:** `start_period: 15s` → `60s`.

**M7 — ports:**
- Server: remove `ports:`, add `expose: ["3001"]`
- Frontend: `ports: ["127.0.0.1:3000:3000"]` (reverse proxy handles external access)

**H4 — frontend healthcheck:**
```yaml
healthcheck:
  test: ["CMD", "node", "-e", "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

**M2/M3/M4/M5 — both services:**
```yaml
init: true
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
image: ocr-lab/server:${TAG:-dev}    # and ocr-lab/frontend:${TAG:-dev}
```

### 2. packages/server/Dockerfile

**H2 — prod-deps prune stage:**
```dockerfile
FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production
```
Production stage copies `node_modules` from `prod-deps` instead of `deps`.
⚠️ Verify `--production` resolves `workspace:*` for `shared`. If the frozen lockfile demands the frontend manifest, keep copying `packages/frontend/package.json` (manifest only — harmless).

**L1 — narrow COPY:** `COPY packages/server/src packages/server/src` + `COPY packages/server/package.json` instead of whole dir.

**H5 — pin base image:** resolve digest at execution time (`docker pull oven/bun:1` then `docker images --digests`), pin `oven/bun:<minor>@sha256:...` in all stages.

### 3. packages/frontend/Dockerfile

**H3 — deps-stage trim:** remove `COPY packages/server/package.json ...` IF `bun install --frozen-lockfile` still passes (lockfile covers whole workspace — may fail; test. If fails, keep the copy and document why).

**H5 — pin** `oven/bun:1` and `node:20-alpine` by digest.

### 4. Docs

- `docs/deployment.md`: env-file split instructions, build-time vs runtime var table, reverse-proxy now required for frontend external access.
- `.env.docker.example`: replace with pointer to the two split examples (or delete — note in commit message).

## Execution order

1. compose: C1 env split + L5 cleanup + PORT literal
2. compose: H1/M1 mem limits (drop `deploy:`)
3. compose: M6 `start_period: 60s`
4. compose: M7 server `expose` + frontend `127.0.0.1:3000:3000`
5. compose: H4 frontend healthcheck, M2 init, M3 hardening, M4 logging, M5 image names, L2 fail-fast
6. server Dockerfile: H2 prod-deps + L1 narrow COPY + H5 pin
7. frontend Dockerfile: H3 deps trim + H5 pin
8. env example files + `.gitignore` + docs

## Verification

1. `docker compose config` — valid, interpolation resolves, no swarm warnings
2. `docker compose build` — both images build (validates H2 `--production` workspace resolution + H3 trim)
3. Create `.env.server`/`.env.frontend` from examples, `docker compose up -d`
4. `docker compose ps` — both services healthy (validates frontend healthcheck + 60s start_period)
5. `docker inspect <server>` — `Memory: 1073741824` actually enforced (vs old ignored `deploy:`)
6. Functional: upload image via frontend `:3000` (through localhost), OCR result returns (server reachable via internal network after M7)
7. `docker exec <server> ls node_modules | grep @types` — empty (dev deps pruned)
8. `docker kill --signal=SIGTERM <server>` — graceful shutdown logged

## Out of scope / follow-ups

- `read_only: true` + tmpfs — needs tesseract cache-path testing first
- Pre-baking traineddata into server image (repo root already has `eng.traineddata` / `fra.traineddata`) — cold-start optimization
- Frontend runtime node→bun swap — optional, no need
