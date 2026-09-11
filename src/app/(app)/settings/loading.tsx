import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando configuración">
      <Skeleton className="h-10 w-full max-w-md rounded-full" />
      <div className="glass-card space-y-4 rounded-2xl p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
