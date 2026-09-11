import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AmbientBackground } from '@/components/ambient/ambient-background'
import { APP_NAME, APP_DESCRIPTION } from '@/config/nav'

/**
 * `variable` binds the loaded font directly to the CSS custom property that
 * `globals.css`'s `@theme` block maps to `--font-sans`/`--font-mono` (plan
 * finding: the old v2 config hardcoded `'Inter'` as a string literal in
 * `tailwind.config.ts` and never actually consumed the `next/font` variable
 * it generated).
 */
const fontSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-inter',
})

const fontMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-geist',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — Gestión de Horarios Universitarios`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: ['horario universitario', 'calculadora de notas', 'gestor de horarios', 'estudiantes', 'autohospedado'],
  authors: [{ name: 'Manuel Amell', url: 'https://github.com/ManuelAmell' }],
  manifest: '/manifest.webmanifest',
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: '/icons/icon.svg',
    // TODO(fase-3-pulido): generar PNG reales 192/512 + apple-touch-icon
    // (180x180). No hay herramienta de rasterizado disponible en este
    // entorno sin instalar una dependencia nueva; el SVG cubre `icon`/`any`
    // y la mayoría de Android/desktop, pero iOS Safari's "Add to Home
    // Screen" prefiere un PNG explícito en `apple`.
    apple: '/icons/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: APP_NAME,
    title: `${APP_NAME} — Gestión de Horarios Universitarios`,
    description: APP_DESCRIPTION,
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7fbfe' },
    { media: '(prefers-color-scheme: dark)', color: '#090e13' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Required so `env(safe-area-inset-bottom)` resolves to a real value
  // instead of 0 (plan finding H5: the mobile bottom nav sat under the
  // iPhone home indicator because this was never set).
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <ThemeProvider>
          <AmbientBackground />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
