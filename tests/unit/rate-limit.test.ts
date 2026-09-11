import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, resetRateLimit, resetRateLimits } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useRealTimers()
  })

  it('allows requests up to the limit within the window', () => {
    const opts = { limit: 3, windowMs: 60_000 }
    const now = 1_000_000

    expect(checkRateLimit('user-a', opts, now).allowed).toBe(true)
    expect(checkRateLimit('user-a', opts, now).allowed).toBe(true)
    expect(checkRateLimit('user-a', opts, now).allowed).toBe(true)
  })

  it('rejects the request once the limit is exhausted', () => {
    const opts = { limit: 2, windowMs: 60_000 }
    const now = 1_000_000

    expect(checkRateLimit('user-b', opts, now).allowed).toBe(true)
    expect(checkRateLimit('user-b', opts, now).allowed).toBe(true)
    const third = checkRateLimit('user-b', opts, now)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterMs).toBeGreaterThan(0)
  })

  it('refills tokens over time', () => {
    const opts = { limit: 1, windowMs: 60_000 }
    const start = 1_000_000

    expect(checkRateLimit('user-c', opts, start).allowed).toBe(true)
    expect(checkRateLimit('user-c', opts, start + 1_000).allowed).toBe(false)
    // A full window later, the single token should be back.
    expect(checkRateLimit('user-c', opts, start + 60_000).allowed).toBe(true)
  })

  it('tracks separate keys independently', () => {
    const opts = { limit: 1, windowMs: 60_000 }
    const now = 2_000_000

    expect(checkRateLimit('user-d', opts, now).allowed).toBe(true)
    expect(checkRateLimit('user-e', opts, now).allowed).toBe(true)
    expect(checkRateLimit('user-d', opts, now).allowed).toBe(false)
  })

  it('resetRateLimit clears a single key', () => {
    const opts = { limit: 1, windowMs: 60_000 }
    const now = 3_000_000

    expect(checkRateLimit('user-f', opts, now).allowed).toBe(true)
    expect(checkRateLimit('user-f', opts, now).allowed).toBe(false)
    resetRateLimit('user-f')
    expect(checkRateLimit('user-f', opts, now).allowed).toBe(true)
  })

  it('works with vitest fake timers driving Date.now()', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const opts = { limit: 2, windowMs: 1_000 }

    expect(checkRateLimit('user-g', opts).allowed).toBe(true)
    expect(checkRateLimit('user-g', opts).allowed).toBe(true)
    expect(checkRateLimit('user-g', opts).allowed).toBe(false)

    vi.advanceTimersByTime(1_000)
    expect(checkRateLimit('user-g', opts).allowed).toBe(true)
    vi.useRealTimers()
  })
})
