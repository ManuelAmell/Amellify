'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, GraduationCap, Calculator, Sparkles, Github, AlertCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured) {
      toast.error(
        'Supabase no está configurado. Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local',
        { duration: 6000 }
      )
      return
    }

    try {
      setLoadingProvider(provider)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        toast.error(`Error al iniciar sesión: ${error.message}`)
      }
    } catch (err: any) {
      toast.error('Error inesperado de autenticación')
    } finally {
      setLoadingProvider(null)
    }
  }

  const handleEnterDemoMode = () => {
    toast.success('Iniciando modo vista previa...')
    router.push('/dashboard')
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Decorative ambient blurred orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="w-full max-w-md space-y-6 z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-inner mb-2">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Amellify <span className="text-primary text-xl font-normal">v2</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Gestión inteligente de horarios universitarios y seguimiento académico en la nube.
          </p>
        </div>

        {/* Supabase Notice if not configured */}
        {!isSupabaseConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Backend Supabase no vinculado en .env.local</p>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Para autenticación real con Google/GitHub, añade tus credenciales en <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">.env.local</code>.
              </p>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <Card className="glass-panel border-border/80 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-xl font-semibold">Bienvenido</CardTitle>
            <CardDescription className="text-xs">
              Inicia sesión con tu cuenta para sincronizar tus materias y notas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loadingProvider !== null}
              className="w-full h-11 relative flex items-center justify-center gap-3 font-medium text-sm border bg-card text-foreground hover:bg-muted/80 shadow-sm transition-all"
              variant="outline"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {loadingProvider === 'google' ? 'Conectando...' : 'Continuar con Google'}
            </Button>

            <Button
              onClick={() => handleOAuthSignIn('github')}
              disabled={loadingProvider !== null}
              className="w-full h-11 flex items-center justify-center gap-3 font-medium text-sm border bg-card text-foreground hover:bg-muted/80 shadow-sm transition-all"
              variant="outline"
            >
              <Github className="h-4 w-4" />
              {loadingProvider === 'github' ? 'Conectando...' : 'Continuar con GitHub'}
            </Button>

            {/* Direct preview / exploration button if credentials are not yet entered */}
            {!isSupabaseConfigured && (
              <Button
                onClick={handleEnterDemoMode}
                className="w-full h-10 text-xs flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                variant="ghost"
              >
                <span>Explorar interfaz (Vista previa local)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            <div className="pt-4 border-t border-border/50 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Grid Semanal</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
                <Calculator className="h-4 w-4 text-primary" />
                <span>Calculadora</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>Import con IA</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Hecho con ❤️ para estudiantes universitarios · Amellify 2026
        </p>
      </div>
    </div>
  )
}
