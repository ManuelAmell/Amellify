import { Skeleton } from '@/components/ui/skeleton'

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-float w-full max-w-md space-y-4 rounded-2xl p-8" aria-busy="true" aria-label="Cargando">
        <Skeleton className="mx-auto h-10 w-10 rounded-xl" />
        <Skeleton className="mx-auto h-5 w-40 rounded" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
