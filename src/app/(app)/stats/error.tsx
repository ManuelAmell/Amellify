'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function StatsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudieron cargar las estadísticas"
      description="Hubo un problema al calcular tus estadísticas."
      error={error}
      reset={reset}
    />
  )
}
