'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudo cargar esta sección"
      description="Hubo un problema al obtener tus datos. Intenta de nuevo en unos segundos."
      error={error}
      reset={reset}
    />
  )
}
