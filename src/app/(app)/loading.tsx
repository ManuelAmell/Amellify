import { Skeleton } from '@/components/ui/skeleton'

/**
 * Generic fallback shown while a segment under `(app)` streams in without a
 * more specific `loading.tsx` of its own (Next nests these — the closer one
 * wins). Kept intentionally plain since every route below has a tailored
 * skeleton matching its actual layout.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  )
}
