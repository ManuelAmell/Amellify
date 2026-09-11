import { Skeleton } from '@/components/ui/skeleton'

export default function CalculatorLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando calculadora">
      <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
      <div className="glass-card space-y-3 rounded-2xl p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  )
}
