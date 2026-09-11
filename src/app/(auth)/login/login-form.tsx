'use client'

import {
  Calculator,
  Calendar,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  User,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'
import { authClient } from '@/lib/auth/client'
import { sanitizeNextPath } from '@/lib/auth/redirect'

type AuthFeatureFlags = {
  github: boolean
  google: boolean
  emailVerification: boolean
  passwordReset: boolean
}

type Tab = 'login' | 'register'

const DEFAULT_ERROR_MESSAGE = 'Ocurrió un problema al iniciar sesión. Intenta de nuevo.'

const ERROR_MESSAGES: Record<string, string> = {
  oauth_callback_error: 'No se pudo completar el inicio de sesión con el proveedor. Intenta de nuevo.',
  account_not_linked: 'Esa cuenta ya está registrada con otro método de acceso.',
  default: DEFAULT_ERROR_MESSAGE,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.38.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a6.9 6.9 0 0 1 0-4.18V7.06H2.18a11 11 0 0 0 0 9.87l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = React.useState<Tab>('login')
  const [flags, setFlags] = React.useState<AuthFeatureFlags | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [oauthLoading, setOauthLoading] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = React.useState(false)
  const [forgotEmail, setForgotEmail] = React.useState('')
  const [forgotStatus, setForgotStatus] = React.useState<string | null>(null)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')

  const nextPath = sanitizeNextPath(searchParams.get('next'))
  const queryError = searchParams.get('error')

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/auth/providers')
      .then((res) => res.json())
      .then((data: AuthFeatureFlags) => {
        if (!cancelled) setFlags(data)
      })
      .catch(() => {
        if (!cancelled) setFlags({ github: false, google: false, emailVerification: false, passwordReset: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (queryError) {
      setFormError(ERROR_MESSAGES[queryError] ?? DEFAULT_ERROR_MESSAGE)
    }
  }, [queryError])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!EMAIL_RE.test(email) || password.length === 0) {
      setFormError('Ingresa un correo válido y tu contraseña.')
      return
    }
    setLoading(true)
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password })
      if (error) {
        setFormError('Correo o contraseña incorrectos.')
        return
      }
      router.push(nextPath)
      router.refresh()
    } catch {
      setFormError('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!EMAIL_RE.test(email)) {
      setFormError('Ingresa un correo válido.')
      return
    }
    if (password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setLoading(true)
    try {
      const { error, data } = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim() || email.split('@')[0]!,
      })
      // Deliberately generic message on any failure — never reveals
      // whether the email is already registered (plan Fase 1 · A).
      if (error) {
        setFormError('No fue posible crear la cuenta. Verifica los datos e intenta de nuevo.')
        return
      }
      if (data?.user && !data.token) {
        setFormError('Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.')
        return
      }
      router.push(nextPath)
      router.refresh()
    } catch {
      setFormError('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider: 'github' | 'google') {
    setOauthLoading(provider)
    setFormError(null)
    try {
      await authClient.signIn.social({ provider, callbackURL: nextPath })
    } catch {
      setFormError('No se pudo conectar con el proveedor. Intenta de nuevo.')
      setOauthLoading(null)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotStatus(null)
    if (!EMAIL_RE.test(forgotEmail)) {
      setForgotStatus('Ingresa un correo válido.')
      return
    }
    try {
      await authClient.requestPasswordReset({ email: forgotEmail.trim(), redirectTo: '/reset-password' })
    } finally {
      // Always show the same message, whether or not the email exists.
      setForgotStatus('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.')
    }
  }

  const anyLoading = loading || oauthLoading !== null

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Amellify</h1>
        <p className="mx-auto max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
          Gestión de horarios universitarios y seguimiento académico.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {(flags?.github || flags?.google) && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {flags?.google && (
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={anyLoading}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {oauthLoading === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                  Google
                </button>
              )}
              {flags?.github && (
                <button
                  type="button"
                  onClick={() => handleOAuth('github')}
                  disabled={anyLoading}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {oauthLoading === 'github' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitHubIcon />}
                  GitHub
                </button>
              )}
            </div>
            <div className="relative my-4 flex items-center justify-center">
              <span className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
              <span className="absolute bg-white px-2 text-[10px] font-semibold uppercase text-neutral-400 dark:bg-neutral-900">
                o con correo
              </span>
            </div>
          </>
        )}

        <div className="mb-4 grid grid-cols-2 rounded-lg bg-neutral-100 p-1 text-sm font-medium dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => {
              setTab('login')
              setFormError(null)
            }}
            className={`rounded-md py-1.5 transition-colors ${
              tab === 'login'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-50'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
            aria-pressed={tab === 'login'}
          >
            Ingresar
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register')
              setFormError(null)
            }}
            className={`rounded-md py-1.5 transition-colors ${
              tab === 'register'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-50'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
            aria-pressed={tab === 'register'}
          >
            Crear cuenta
          </button>
        </div>

        {formError && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {formError}
          </p>
        )}

        {tab === 'login' ? (
          showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <Field label="Correo electrónico" icon={<Mail className="h-3.5 w-3.5" />}>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="h-9 w-full rounded-lg border border-neutral-300 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  placeholder="tu@correo.edu.co"
                  required
                />
              </Field>
              {forgotStatus && <p className="text-xs text-neutral-600 dark:text-neutral-300">{forgotStatus}</p>}
              <button
                type="submit"
                className="h-9 w-full rounded-lg bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700"
              >
                Enviar enlace
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-center text-xs text-neutral-500 hover:underline dark:text-neutral-400"
              >
                Volver a iniciar sesión
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field label="Correo electrónico" icon={<Mail className="h-3.5 w-3.5" />}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 w-full rounded-lg border border-neutral-300 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  placeholder="tu@correo.edu.co"
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Contraseña" icon={<Lock className="h-3.5 w-3.5" />}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 w-full rounded-lg border border-neutral-300 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>
              {flags?.passwordReset && (
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-teal-700 hover:underline dark:text-teal-400"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
              <button
                type="submit"
                disabled={anyLoading}
                className="flex h-9 w-full items-center justify-center rounded-lg bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar a mi cuenta'}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <Field label="Nombre completo" icon={<User className="h-3.5 w-3.5" />}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-300 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="Tu nombre"
                autoComplete="name"
              />
            </Field>
            <Field label="Correo electrónico" icon={<Mail className="h-3.5 w-3.5" />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-300 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="tu@correo.edu.co"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Contraseña" icon={<Lock className="h-3.5 w-3.5" />}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-300 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <button
              type="submit"
              disabled={anyLoading}
              className="flex h-9 w-full items-center justify-center rounded-lg bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar cuenta'}
            </button>
          </form>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-4 text-center text-[10px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-neutral-50 p-1.5 dark:bg-neutral-800/60">
            <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Grid semanal</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-neutral-50 p-1.5 dark:bg-neutral-800/60">
            <Calculator className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Calculadora</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-neutral-50 p-1.5 dark:bg-neutral-800/60">
            <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Import con IA</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">{icon}</span>
        {children}
      </span>
    </label>
  )
}
