/**
 * Validates a `?next=` redirect target (plan finding C3: open redirect).
 * Only allows same-origin, absolute-path redirects: must start with a
 * single `/` and never `//` (protocol-relative URL, e.g. `//evil.com`)
 * nor `/\` (browsers treat backslashes as forward slashes, so
 * `/\evil.com` is also protocol-relative) nor contain a scheme.
 *
 * Extracted as a pure function so it can be unit-tested without spinning
 * up the whole proxy/middleware (plan Fase 1 · A test list).
 */
export function sanitizeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  // Reject anything that smuggles a scheme/host past the leading slash,
  // e.g. "/\t/evil.com" or "/%2F%2Fevil.com" style tricks decoded later.
  if (/^\/\s*[\\/]/.test(next)) return fallback
  try {
    // Decoding also catches encoded traversal like "/%2f%2fevil.com".
    const decoded = decodeURIComponent(next)
    if (decoded.startsWith('//') || decoded.startsWith('/\\')) return fallback
  } catch {
    return fallback
  }
  return next
}
