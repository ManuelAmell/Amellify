import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight scroll container styled to match the app's thin themed
 * scrollbar (see `globals.css` `scrollbar-width`/`scrollbar-color`). Not
 * built on `@radix-ui/react-scroll-area` — that package isn't in
 * `node_modules` and this environment forbids installing new dependencies;
 * native overflow scrolling with the themed scrollbar covers every current
 * use case (command palette, dropdown/select long lists already scroll on
 * their own Radix viewports).
 */
const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('relative overflow-auto overscroll-contain', className)} {...props}>
      {children}
    </div>
  )
)
ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }
