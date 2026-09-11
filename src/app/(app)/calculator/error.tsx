'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function CalculatorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudo cargar la calculadora"
      description="Hubo un problema al obtener tus notas y parciales."
      error={error}
      reset={reset}
    />
  )
}
