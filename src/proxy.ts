import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import { sanitizeNextPath } from '@/lib/auth/redirect'

/**
 * Session gating for page routes (plan Fase 1 · A). Deliberately cheap:
 * `getSessionCookie` only checks that a well-formed session cookie is
 * present, it does NOT hit the database — that deeper check happens in
 * `requireUser()` (`src/lib/auth/session.ts`) inside Server Components,
 * which is where an actually-expired/forged session gets rejected.
 *
 * Never "fail open" (plan finding C9): any error while reading the
 * cookie is treated as "no session", never as "authenticated".
 */
const PROTECTED_PREFIXES = ['/dashboard', '/courses', '/calculator', '/stats', '/settings']
const AUTH_PAGE_PREFIXES = ['/login']

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  let hasSession = false
  try {
    hasSession = getSessionCookie(request) !== null
  } catch {
    hasSession = false // fail closed, never open (C9)
  }

  if (matchesPrefix(pathname, AUTH_PAGE_PREFIXES)) {
    if (hasSession) {
      const next = sanitizeNextPath(request.nextUrl.searchParams.get('next'))
      return NextResponse.redirect(new URL(next, request.url))
    }
    return NextResponse.next()
  }

  if (matchesPrefix(pathname, PROTECTED_PREFIXES) && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next internals)
     * - manifest.webmanifest, sw.js (PWA — must stay publicly reachable, see H19)
     * - favicon.ico and static image/font extensions
     */
    '/((?!_next/static|_next/image|manifest\\.webmanifest|sw\\.js|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
