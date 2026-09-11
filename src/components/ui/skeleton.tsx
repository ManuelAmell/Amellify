import { cn } from '@/lib/utils'

/**
 * Glass-tier skeleton for `loading.tsx` boundaries — a translucent block with
 * a shimmering sweep (disabled under `prefers-reduced-motion`, see the
 * `animate-shimmer` utility in `globals.css`).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn('glass-inset animate-shimmer rounded-lg', className)}
      {...props}
    />
  )
}

export { Skeleton }
