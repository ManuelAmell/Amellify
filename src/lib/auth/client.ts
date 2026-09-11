import { createAuthClient } from 'better-auth/react'

/**
 * Browser auth client singleton (fixes plan finding: `createClient()` was
 * being re-instantiated on every render in the old login page).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})

export const { useSession, signIn, signUp, signOut } = authClient
