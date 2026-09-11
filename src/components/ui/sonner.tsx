'use client'

import { useTheme } from 'next-themes'
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

/**
 * Wraps `sonner`'s Toaster reading the *resolved* theme from `next-themes`.
 * The old v2 root layout hardcoded `theme="system"` on the Toaster itself,
 * which made sonner run its own (unrelated) system-preference check instead
 * of following whatever theme the user actually picked via `next-themes` —
 * toasts would flip dark/light independently of the rest of the UI.
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <SonnerToaster
      theme={(resolvedTheme as ToasterProps['theme']) ?? 'system'}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'glass-float rounded-2xl',
        },
      }}
      {...props}
    />
  )
}
