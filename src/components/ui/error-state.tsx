'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface ErrorStateProps {
  title?: string
  description?: string
  /** Passed through from Next's `error.tsx` boundary — re-renders the segment. */
  reset?: () => void
  /** Shown in a collapsible <details> during development only. */
  error?: Error & { digest?: string }
  homeHref?: string
}

/**
 * Shared visual for every `error.tsx` / `global-error.tsx` boundary (plan
 * finding H7: v2 had none of these, so any thrown error showed Next's raw
 * default error page — no route survived a server action failure
 * gracefully).
 */
export function ErrorState({
  title = 'Algo salió mal',
  description = 'Ocurrió un error inesperado al cargar esta página. Puedes intentarlo de nuevo.',
  reset,
  error,
  homeHref = '/dashboard',
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
      <Card tier="float" className="w-full max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {process.env.NODE_ENV === 'development' && error && (
            <details className="w-full rounded-lg bg-muted/60 p-3 text-left text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Detalles (solo desarrollo)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
            </details>
          )}

          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
            {reset && (
              <Button variant="default" className="flex-1" onClick={reset}>
                <RotateCw className="h-4 w-4" />
                Reintentar
              </Button>
            )}
            <Button variant="outline" className="flex-1" asChild>
              <Link href={homeHref}>
                <Home className="h-4 w-4" />
                Volver al inicio
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
