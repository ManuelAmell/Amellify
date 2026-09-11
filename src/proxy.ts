import { NextResponse, type NextRequest } from 'next/server'

/**
 * TODO(Fase 1 · Agent A — Datos + Auth): replace this passthrough with the
 * real session-cookie check + redirect logic described in the plan
 * (section 3, Fase 1 · A):
 *   - Cheap cookie-presence check only (no DB/network round trip here).
 *   - Redirect unauthenticated requests to `/login` for protected routes.
 *   - Redirect authenticated requests away from `/login`/`/register`.
 *   - Validate `?next=` (must start with a single `/`, never `//`) before
 *     using it in any redirect — see plan finding C3 (open redirect).
 *   - Never swallow errors into a "fail open" fallback — see plan finding C9.
 */
export function proxy(_request: NextRequest) {
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
