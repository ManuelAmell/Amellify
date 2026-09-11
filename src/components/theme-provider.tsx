'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * `disableTransitionOnChange` is intentionally omitted (plan 2.1 optional
 * improvement): with it enabled next-themes force-disables *all* CSS
 * transitions for one frame on toggle, which also kills the deliberate
 * background/box-shadow cross-fade on the glass surfaces. Leaving it off
 * lets `.dark` swap animate smoothly; `prefers-reduced-motion` still governs
 * whether those transitions actually run (see `src/app/globals.css`).
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  )
}
