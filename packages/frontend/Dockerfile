FROM oven/bun:1@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS builder
WORKDIR /app

ARG CSRF_TRUSTED_ORIGINS
ENV CSRF_TRUSTED_ORIGINS=${CSRF_TRUSTED_ORIGINS}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules

COPY packages/frontend/ packages/frontend/
COPY packages/shared/ packages/shared/
COPY package.json tsconfig.json ./
RUN bun run build:frontend

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS production
WORKDIR /app

COPY --from=builder /app/packages/frontend/build ./build

USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
