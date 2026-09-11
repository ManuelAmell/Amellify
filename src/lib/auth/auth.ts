import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import { account, session, user, verification } from '@/db/schema'
import { isEmailConfigured, sendEmail } from './mailer'

/**
 * Better Auth server configuration.
 * Owned by Fase 1 · Agent A — see plan section 1.1/1.4.
 *
 * - GitHub OAuth works over plain HTTP/IP; Google requires HTTPS + a real
 *   domain, so it self-gates by only registering when its env vars exist
 *   (plan 1.4). Neither is registered unless both client id + secret are set.
 * - Password reset / email verification are wired only when SMTP_HOST is
 *   set (plan Fase 1 · A); otherwise email/password sign-in still works,
 *   the UI just doesn't offer "forgot password" (see /api/auth/providers).
 * - Minimum password length 8 (plan Fase 1 · A).
 */
const hasGitHubOAuth = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const hasSmtp = isEmailConfigured()

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret:
    process.env.BETTER_AUTH_SECRET ||
    (isBuildPhase ? 'build-time-placeholder-not-used-at-runtime' : undefined),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
    ...(hasSmtp
      ? {
          sendResetPassword: async ({ user: target, url }) => {
            await sendEmail({
              to: target.email,
              subject: 'Restablece tu contraseña de Amellify',
              text: `Hola,\n\nRecibimos una solicitud para restablecer tu contraseña. Abre este enlace (válido por 1 hora):\n${url}\n\nSi no fuiste tú, ignora este correo.`,
              html: `<p>Hola,</p><p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace (válido por 1 hora):</p><p><a href="${url}">Restablecer contraseña</a></p><p>Si no fuiste tú, ignora este correo.</p>`,
            })
          },
        }
      : {}),
  },
  ...(hasSmtp
    ? {
        emailVerification: {
          sendVerificationEmail: async ({ user: target, url }) => {
            await sendEmail({
              to: target.email,
              subject: 'Verifica tu correo en Amellify',
              text: `Hola,\n\nVerifica tu correo abriendo este enlace:\n${url}`,
              html: `<p>Hola,</p><p>Verifica tu correo haciendo clic en el siguiente enlace:</p><p><a href="${url}">Verificar correo</a></p>`,
            })
          },
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
        },
      }
    : {}),
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
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  advanced: {
    // No domain yet (plan 1.4: access by IP) — cookies must work over
    // plain HTTP. Better Auth infers `secure` from BETTER_AUTH_URL's
    // protocol already; this is an explicit fallback for local/dev.
    useSecureCookies: (process.env.BETTER_AUTH_URL ?? '').startsWith('https://'),
  },
})

export type Auth = typeof auth

/** Which optional auth features are actually usable right now (server-side only). */
export function getAuthFeatureFlags() {
  return {
    github: hasGitHubOAuth,
    google: hasGoogleOAuth,
    emailVerification: hasSmtp,
    passwordReset: hasSmtp,
  }
}
