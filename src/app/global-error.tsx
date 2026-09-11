'use client'

import './globals.css'

/**
 * Root-segment error boundary — only fires if `layout.tsx` itself throws
 * (e.g. a font-loading or provider crash), in which case Next unmounts the
 * entire tree including the root layout, so this file must supply its own
 * `<html>`/`<body>`. Because of that it can't rely on `ThemeProvider`
 * (`next-themes` context isn't mounted here), so it always renders in the
 * light palette regardless of OS preference — an acceptable trade-off for a
 * last-resort screen that should basically never appear.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-background px-4 py-12 font-sans text-foreground antialiased">
        <div className="glass-float w-full max-w-md rounded-2xl p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-semibold">Amellify no pudo iniciar</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ocurrió un error crítico al cargar la aplicación. Intenta recargar la página.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
