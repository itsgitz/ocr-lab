FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app

ARG CSRF_TRUSTED_ORIGINS
ENV CSRF_TRUSTED_ORIGINS=${CSRF_TRUSTED_ORIGINS}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules

COPY packages/frontend/ packages/frontend/
COPY packages/shared/ packages/shared/
COPY package.json tsconfig.json ./
RUN bun run build:frontend

FROM node:20-alpine AS production
WORKDIR /app

COPY --from=builder /app/packages/frontend/build ./build

USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
