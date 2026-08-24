'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, GraduationCap, Calculator, Sparkles, Github, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [loading, setLoading] = React.useState(false)
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [fullName, setFullName] = React.useState('')
  const router = useRouter()
  const supabase = createClient()

  // Handle Email + Password Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Ingresa tu correo y contraseña')
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        toast.error(error.message || 'Error al iniciar sesión')
        return
      }

      toast.success('¡Bienvenido de vuelta!')
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  // Handle Email + Password Sign Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Ingresa correo y contraseña')
      return
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim() || email.split('@')[0],
          },
        },
      })

      if (error) {
        toast.error(error.message || 'Error al registrarte')
        return
      }

      if (data.session) {
        toast.success('¡Cuenta creada exitosamente!')
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.success('Cuenta registrada. Si tienes confirmación de correo activa, revisa tu bandeja de entrada.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  // Handle OAuth Sign In
  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    try {
      setLoadingProvider(provider)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        if (error.message?.includes('provider is not enabled')) {
          toast.error(
            `El proveedor ${provider === 'google' ? 'Google' : 'GitHub'} no está activado en tu panel de Supabase. Puedes usar Correo y Contraseña abajo, o activarlo en Authentication -> Providers.`,
            { duration: 8000 }
          )
        } else {
          toast.error(`Error: ${error.message}`)
        }
      }
    } catch (err: any) {
      toast.error('Error inesperado al conectar con el proveedor')
    } finally {
      setLoadingProvider(null)
    }
  }

  const handleEnterDemoMode = () => {
    toast.success('Entrando en modo vista previa...')
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
            Gestión inteligente de horarios universitarios y seguimiento académico.
          </p>
        </div>

        {/* Auth Card */}
        <Card className="glass-panel border-border/80 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1 text-center pb-3">
            <CardTitle className="text-xl font-semibold">Iniciar Sesión</CardTitle>
            <CardDescription className="text-xs">
              Accede a tu cuenta de Supabase para sincronizar tus materias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OAuth Quick Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={loadingProvider !== null || loading}
                className="h-10 text-xs font-medium border bg-card text-foreground hover:bg-muted shadow-xs flex items-center justify-center gap-2"
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
                Google
              </Button>

              <Button
                type="button"
                onClick={() => handleOAuthSignIn('github')}
                disabled={loadingProvider !== null || loading}
                className="h-10 text-xs font-medium border bg-card text-foreground hover:bg-muted shadow-xs flex items-center justify-center gap-2"
                variant="outline"
              >
                <Github className="h-4 w-4" />
                GitHub
              </Button>
            </div>

            <div className="relative flex items-center justify-center">
              <span className="h-px w-full bg-border" />
              <span className="absolute bg-card px-2 text-[10px] uppercase font-semibold text-muted-foreground">
                o con correo
              </span>
            </div>

            {/* Email / Password Tabs */}
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid grid-cols-2 mb-3">
                <TabsTrigger value="login" className="text-xs">Ingresar</TabsTrigger>
                <TabsTrigger value="register" className="text-xs">Crear Cuenta</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleEmailSignIn} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Correo Electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="tu@correo.edu.co"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-9 pl-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-9 pl-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || loadingProvider !== null}
                    className="w-full h-9 text-xs font-semibold mt-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar a mi Cuenta'}
                  </Button>
                </form>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register">
                <form onSubmit={handleEmailSignUp} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Manuel Amell"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-9 pl-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Correo Electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="tu@correo.edu.co"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-9 pl-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-9 pl-9 text-xs"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || loadingProvider !== null}
                    className="w-full h-9 text-xs font-semibold mt-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Cuenta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Direct preview button */}
            <Button
              type="button"
              onClick={handleEnterDemoMode}
              className="w-full h-9 text-xs flex items-center justify-center gap-2 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/50"
              variant="ghost"
            >
              <span>Explorar interfaz en modo demo</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>

            <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-muted/30">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px]">Grid Semanal</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-muted/30">
                <Calculator className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px]">Calculadora</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-muted/30">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span className="text-[10px]">Import con IA</span>
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
