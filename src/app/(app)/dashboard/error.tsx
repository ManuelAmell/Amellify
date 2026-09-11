'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudo cargar tu horario"
      description="Hubo un problema al obtener tus materias y horarios."
      error={error}
      reset={reset}
    />
  )
}
