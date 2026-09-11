import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = {
  title: 'Iniciar sesión · Amellify',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <Suspense fallback={<div className="text-sm text-neutral-500">Cargando…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
