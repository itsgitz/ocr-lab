import type { MiddlewareHandler } from "hono";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function getClientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
}

function evictExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

export function forceCleanup(): void {
  evictExpiredEntries();
}

export function startCleanupTimer(intervalMs: number): void {
  stopCleanupTimer();
  cleanupTimer = setInterval(evictExpiredEntries, intervalMs);
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    (cleanupTimer as { unref(): void }).unref();
  }
}

export function stopCleanupTimer(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max } = options;

  return async (c, next) => {
    const ip = getClientIp(c);
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetTime) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      await next();
      return;
    }

    entry.count++;

    if (entry.count > max) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  };
}

export function resetRateLimits(): void {
  store.clear();
  stopCleanupTimer();
}
