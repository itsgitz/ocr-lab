FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1 AS production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules

COPY packages/server/ packages/server/
COPY packages/shared/ packages/shared/
COPY package.json ./

USER bun
EXPOSE 3001
CMD ["bun", "run", "packages/server/src/index.ts"]
