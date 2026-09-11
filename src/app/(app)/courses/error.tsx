'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function CoursesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudieron cargar tus materias"
      description="Hubo un problema al obtener la lista de materias."
      error={error}
      reset={reset}
    />
  )
}
