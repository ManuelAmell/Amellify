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
