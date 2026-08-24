import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Amellify — Gestión de Horarios Universitarios',
  description:
    'Organiza tu semestre universitario con horario visual interactivo, calculadora de notas ponderadas y estadísticas en la nube con Supabase.',
  keywords: ['horario universitario', 'calculadora de notas', 'gestor de horarios', 'estudiantes'],
  authors: [{ name: 'Manuel Amell', url: 'https://github.com/ManuelAmell' }],
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0D9488' },
    { media: '(prefers-color-scheme: dark)', color: '#0C0A09' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            theme="system"
            toastOptions={{
              style: {
                borderRadius: '0.75rem',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
