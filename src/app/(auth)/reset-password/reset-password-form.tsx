'use client'

import { CheckCircle2, Loader2, Lock } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'
import { authClient } from '@/lib/auth/client'

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!token) {
      setError('El enlace no es válido o ya expiró. Solicita uno nuevo.')
      return
    }
    setLoading(true)
    try {
      const { error: resetError } = await authClient.resetPassword({ newPassword: password, token })
      if (resetError) {
        setError('El enlace no es válido o ya expiró. Solicita uno nuevo.')
        return
      }
      setDone(true)
    } catch {
      setError('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-center text-xl font-bold text-neutral-900 dark:text-neutral-50">
        Restablecer contraseña
      </h1>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {done ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-teal-600 dark:text-teal-400" />
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Tu contraseña fue actualizada. Ya puedes iniciar sesión.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Nueva contraseña</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 w-full rounded-lg border border-neutral-300 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="flex h-9 w-full items-center justify-center rounded-lg bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
