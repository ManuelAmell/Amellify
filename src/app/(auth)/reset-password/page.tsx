import { Suspense } from 'react'
import { ResetPasswordForm } from './reset-password-form'

export const metadata = {
  title: 'Restablecer contraseña · Amellify',
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <Suspense fallback={<div className="text-sm text-neutral-500">Cargando…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
