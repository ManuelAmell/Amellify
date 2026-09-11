import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'

/**
 * Better Auth server configuration.
 * Owned by Fase 1 · Agent A — see plan section 1.1/1.4.
 *
 * TODO(Agent A):
 * - Run `pnpm auth:generate` to produce `src/db/auth-schema.ts`, then
 *   reconcile it with the placeholder `user` table in `src/db/schema.ts`
 *   (the profile fields — university, preferences, etc. — must survive).
 * - Gate `socialProviders.google`/`.github` on whether their env vars are
 *   set (plan 1.4: self-hosted by IP has no HTTPS, so Google OAuth stays
 *   disabled until a domain exists; GitHub OAuth works over plain HTTP).
 * - Wire `emailAndPassword.sendResetPassword` / `emailVerification` only
 *   when SMTP_* env vars are present; otherwise leave those features off
 *   and say so in the UI (plan 2.4).
 * - Minimum password length 8 (plan Fase 1 · A).
 */
const hasGitHubOAuth = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  socialProviders: {
    ...(hasGitHubOAuth
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(hasGoogleOAuth
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
  },
})

export type Auth = typeof auth
