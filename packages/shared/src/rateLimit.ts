export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 5000;

function cleanupBuckets(now: number, maxWindowMs: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, timestamps] of buckets.entries()) {
    const fresh = timestamps.filter((t) => now - t < maxWindowMs);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, fresh);
    }
  }
}

/**
 * Sliding-window rate limiter (in-memory per instance).
 * Для распределённого кластера может быть заменён на Redis/Upstash с тем же интерфейсом.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupBuckets(now, options.windowMs);

  const existing = buckets.get(key) ?? [];
  const windowStart = now - options.windowMs;
  const fresh = existing.filter((ts) => ts > windowStart);

  if (fresh.length >= options.limit) {
    const oldestInWindow = fresh[0] ?? now;
    const retryAfterMs = Math.max(1000, oldestInWindow + options.windowMs - now);
    buckets.set(key, fresh);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  fresh.push(now);
  buckets.set(key, fresh);

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - fresh.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Извлекает IP клиента из заголовков прокси (Vercel / Nginx / Cloudflare).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}
