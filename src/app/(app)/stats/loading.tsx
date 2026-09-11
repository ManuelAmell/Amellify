import { Skeleton } from '@/components/ui/skeleton'

export default function StatsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando estadísticas">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="glass-card flex h-64 items-end gap-2 rounded-2xl p-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="w-full rounded-t-lg" style={{ height: `${30 + ((i * 13) % 60)}%` }} />
        ))}
      </div>
    </div>
  )
}
