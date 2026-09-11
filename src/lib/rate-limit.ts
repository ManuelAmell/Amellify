/**
 * In-memory token-bucket rate limiter.
 *
 * This is a self-hosted, single-instance app (plan 1.1/6: "rate limit ...
 * en memoria asumen una instancia"), so a `Map` is sufficient — no Redis.
 * If Amellify is ever scaled horizontally, move this to a shared store
 * (e.g. a Postgres `UNLOGGED` table) instead of adding Redis just for this.
 *
 * Used by `/api/ai/extract-schedule` to enforce 5 requests/minute/user
 * (plan 1.3 / H16 fix: the old route had no rate limiting at all).
 */

interface Bucket {
  /** Tokens currently available (fractional, refilled continuously). */
  tokens: number
  /** Timestamp (ms) of the last refill. */
  lastRefill: number
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed per `windowMs`. */
  limit: number
  /** Window size in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Tokens left after this check (floored), for diagnostics/headers. */
  remaining: number
  /** Only set when `allowed` is false: how long to wait before retrying. */
  retryAfterMs?: number
}

const buckets = new Map<string, Bucket>()

/**
 * Checks and consumes one token for `key` under a continuous token-bucket
 * refill model (equivalent to a sliding window, but O(1) and easy to test).
 *
 * @param key Composite identifier, e.g. `${userId}` or `${userId}:${ip}`.
 * @param now Injectable clock for tests (defaults to `Date.now()`); also
 *   plays nicely with `vi.useFakeTimers()` + `vi.setSystemTime()`.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now()
): RateLimitResult {
  if (limit <= 0 || windowMs <= 0) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs }
  }

  const refillRatePerMs = limit / windowMs

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now }
    buckets.set(key, bucket)
  }

  const elapsed = Math.max(0, now - bucket.lastRefill)
  if (elapsed > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRatePerMs)
    bucket.lastRefill = now
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true, remaining: Math.floor(bucket.tokens) }
  }

  const deficit = 1 - bucket.tokens
  const retryAfterMs = Math.ceil(deficit / refillRatePerMs)
  return { allowed: false, remaining: 0, retryAfterMs }
}

/** Drops all bucket state. Exposed for tests only. */
export function resetRateLimits(): void {
  buckets.clear()
}

/** Drops a single key's bucket state (e.g. after a successful password reset). */
export function resetRateLimit(key: string): void {
  buckets.delete(key)
}
