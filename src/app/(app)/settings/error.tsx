'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudo cargar la configuración"
      description="Hubo un problema al obtener tu perfil."
      error={error}
      reset={reset}
    />
  )
}
