# Docker Common Issues

Troubleshooting reference for Docker-specific problems in OCR Lab. For general deployment issues (CSRF, CSS, ports), see [deployment.md](../deployment.md).

---

## 1. Frontend can't reach the server API

**Symptoms:**
- OCR form returns a 500 or network error
- `docker compose logs ocr-lab-frontend` shows `ECONNREFUSED` or `fetch failed`

**Cause:**  
`PUBLIC_API_URL=http://localhost:3001` — inside the frontend container, `localhost` refers to the container itself, not the server container.

**Fix:**  
```env
PUBLIC_API_URL=http://ocr-lab-server:3001
```

Use the Docker service name (`ocr-lab-server`) as the hostname. Docker's internal DNS resolves service names to container IPs on the shared `ocr-net` network.

---

## 2. CSRF 403 on form submit

**Symptoms:**
- Uploading an image returns HTTP 403
- `docker compose logs ocr-lab-frontend` shows `Cross-site POST form submissions are forbidden`

**Cause:**  
SvelteKit `adapter-node` defaults the expected origin to `https://` when `ORIGIN` is not set. The browser sends `http://`, causing a mismatch.

**Fix:**  
Set `ORIGIN` to the URL users actually access the app from:

```env
# Local development
ORIGIN=http://localhost:3000

# Remote VPS
ORIGIN=http://103.41.206.197:3000
```

This is the same fix as in the PM2 deployment. See also: [deployment.md](../deployment.md).

---

## 3. Tesseract trained data not found

**Symptoms:**
- Server starts but OCR requests fail with an error about missing language data
- `docker compose logs ocr-lab-server` shows `Error: Could not initialize tesseract` or file not found

**Cause:**  
`*.traineddata` files were accidentally excluded from the Docker build context (e.g., added to `.dockerignore`).

**Fix:**  
Ensure `.dockerignore` does **not** contain `*.traineddata`. The files `eng.traineddata` and `fra.traineddata` at the monorepo root must be available when Docker builds the server image.

Verify they are accessible to the build:
```bash
docker compose build --progress=plain ocr-lab-server 2>&1 | grep traineddata
# Should show a COPY step that includes the .traineddata files
```

---

## 4. `exec format error` — wrong architecture

**Symptoms:**
- Container immediately exits
- `docker compose logs ocr-lab-server` shows `exec format error`

**Cause:**  
The image was built on an ARM machine (e.g., Apple Silicon Mac) and deployed to an amd64 VPS, or vice versa.

**Fix:**  
Specify the target platform at build time:

```bash
docker compose build --platform linux/amd64
docker compose up -d
```

Or add `platform:` to each service in `docker-compose.yml`:

```yaml
services:
  ocr-lab-server:
    platform: linux/amd64
    ...
  ocr-lab-frontend:
    platform: linux/amd64
    ...
```

---

## 5. Frontend starts before server is ready

**Symptoms:**
- Immediately after `docker compose up`, uploading an image fails
- Error clears after waiting ~10–15 seconds
- `docker compose logs ocr-lab-frontend` shows early connection errors to `ocr-lab-server`

**Cause:**  
The Tesseract.js worker takes a few seconds to initialize on server startup. If the frontend starts before the server's healthcheck passes, the first requests may fail.

**Fix:**  
The `docker-compose.yml` includes:
```yaml
depends_on:
  ocr-lab-server:
    condition: service_healthy
```

This requires `curl` to be installed in the server image (used by the healthcheck). If `curl` is missing, Docker skips the healthcheck and starts the frontend immediately.

Verify the healthcheck is running:
```bash
docker inspect ocr-lab-ts-ocr-lab-server-1 | grep -A 10 '"Health"'
```

If `Status` is `starting` or `unhealthy`, check whether `curl` is available in the server image:
```bash
docker compose exec ocr-lab-server curl http://localhost:3001/api/health
```

---

## 6. `bun install` fails inside Docker (workspace resolution)

**Symptoms:**
- `docker compose build` fails during the `RUN bun install` step
- Error: `package not found: shared@workspace:*` or similar workspace resolution error

**Cause:**  
`bun install` was run from the wrong working directory — not the monorepo root. Workspace resolution requires the root `package.json` and `bun.lock` to be present.

**Fix:**  
The Dockerfile must:
1. Set `WORKDIR /app` (monorepo root)
2. Copy the root `package.json`, `bun.lock`, and **all** `packages/*/package.json` files before running `bun install`
3. Only then run `RUN bun install --frozen-lockfile`

If modifying the Dockerfile, verify the `COPY` order:
```dockerfile
COPY package.json bun.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile
```

---

## 7. Large image size

**Symptoms:**
- `docker images` shows images > 2 GB
- Slow pushes to a registry

**Cause:**  
Source files, `node_modules` from the build stage, or unnecessary system packages were included in the final image.

**Fix:**  
Both Dockerfiles use multi-stage builds. Verify the final stage only copies necessary artifacts:

- **Server image:** Should contain `oven/bun:1` base + `node_modules/` + `packages/*/src/` + trained data. Source files are small; `node_modules` for Tesseract.js is unavoidably large (~300 MB).
- **Frontend image:** Should be `node:20-alpine` + only `packages/frontend/build/` + production `node_modules`. Source files and Vite/Svelte devDependencies should NOT be present.

Check image layers:
```bash
docker history ocr-lab-ts-ocr-lab-frontend
```

If a layer is unexpectedly large, identify which `COPY` instruction caused it and scope it down.

---

## 8. Changes not reflected after `docker compose up`

**Symptoms:**
- Code changes are deployed but the running app still shows old behavior

**Cause:**  
Running `docker compose up -d` without `--build` uses cached images.

**Fix:**  
Always use `--build` when deploying updates:

```bash
docker compose up --build -d
```

To force a clean rebuild (bypassing layer cache):

```bash
docker compose build --no-cache
docker compose up -d
```

---

## 9. Port already in use

**Symptoms:**
- `docker compose up` fails with `bind: address already in use`

**Cause:**  
Another process (e.g., a running PM2 instance or previous Docker container) is already bound to port 3000 or 3001.

**Fix:**  
```bash
# Find and stop PM2 if still running
pm2 stop all

# Or find the process using the port
lsof -i :3000
lsof -i :3001

# Remove stopped containers that may hold the port
docker compose down
```

Then re-run `docker compose up --build -d`.

---

## See Also

- [Docker deployment guide](../docker.md) — full setup reference
- [Deployment guide (PM2)](../deployment.md) — bare-metal reference
- [Tailwind CSS not loading](./tailwind-css-not-loading.md) — applies to both PM2 and Docker
