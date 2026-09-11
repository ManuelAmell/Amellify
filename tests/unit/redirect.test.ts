import { describe, expect, it } from 'vitest'
import { sanitizeNextPath } from '@/lib/auth/redirect'

// Plan finding C3 (open redirect via `?next=`).
describe('sanitizeNextPath', () => {
  it('allows a plain absolute path', () => {
    expect(sanitizeNextPath('/courses')).toBe('/courses')
    expect(sanitizeNextPath('/dashboard?tab=grid')).toBe('/dashboard?tab=grid')
  })

  it('falls back on missing/empty input', () => {
    expect(sanitizeNextPath(null)).toBe('/dashboard')
    expect(sanitizeNextPath(undefined)).toBe('/dashboard')
    expect(sanitizeNextPath('')).toBe('/dashboard')
  })

  it('rejects protocol-relative and absolute URLs', () => {
    expect(sanitizeNextPath('//evil.com')).toBe('/dashboard')
    expect(sanitizeNextPath('https://evil.com')).toBe('/dashboard')
    expect(sanitizeNextPath('evil.com')).toBe('/dashboard')
  })

  it('rejects backslash tricks browsers treat as protocol-relative', () => {
    expect(sanitizeNextPath('/\\evil.com')).toBe('/dashboard')
  })

  it('rejects encoded traversal that decodes to protocol-relative', () => {
    expect(sanitizeNextPath('/%2f%2fevil.com')).toBe('/dashboard')
    expect(sanitizeNextPath('/%2F%2Fevil.com')).toBe('/dashboard')
  })

  it('respects a custom fallback', () => {
    expect(sanitizeNextPath('//evil.com', '/login')).toBe('/login')
  })
})
