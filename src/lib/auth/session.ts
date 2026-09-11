import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'

/**
 * Deduped per-request session lookup (fixes plan finding H8: layout + page
 * both fetching the same data). Use this everywhere instead of calling
 * `auth.api.getSession` directly.
 */
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/**
 * Require an authenticated user or redirect to /login.
 *
 * IMPORTANT (plan finding C2): `redirect()` throws `NEXT_REDIRECT` — never
 * call this inside a try/catch that could swallow that throw. The old
 * `(app)/layout.tsx` did exactly that and fell through to a fake demo user.
 */
export async function requireUser() {
  const session = await getCurrentSession()
  if (!session?.user) {
    redirect('/login')
  }
  return session.user
}

/**
 * Session check for Route Handlers (`src/app/api/**`), where `requireUser()`
 * is the wrong tool: its `redirect('/login')` returns a 307 whose body is
 * the login page's HTML, and a `fetch()`-based caller (e.g. `AIImportDialog`)
 * gets `response.ok === true` for a redirect it silently followed, then
 * throws trying to `JSON.parse` that HTML — surfacing a garbled error
 * instead of "session expired, log in again" (found by /code-review).
 * Route handlers should check `user` themselves and return a real 401:
 *   const user = await getApiUser()
 *   if (!user) return NextResponse.json({ error: '...' }, { status: 401 })
 */
export async function getApiUser() {
  const session = await getCurrentSession()
  return session?.user ?? null
}
