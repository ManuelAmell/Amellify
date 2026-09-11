'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudo cargar la autenticación"
      description="Hubo un problema inesperado. Intenta de nuevo."
      error={error}
      reset={reset}
      homeHref="/login"
    />
  )
}
