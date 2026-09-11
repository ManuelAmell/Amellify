import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow-sm',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow-sm',
        outline: 'border-border text-foreground bg-transparent',
        accent: 'border-transparent bg-accent text-accent-foreground shadow-sm',
        success: 'border-transparent bg-success text-success-foreground shadow-sm',
        warning: 'border-transparent bg-warning text-warning-foreground shadow-sm',
        info: 'border-transparent bg-info text-info-foreground shadow-sm',
        glass: 'glass-card border-transparent text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/**
 * Renders a `<span>`, not a `<div>` — the old v2 Badge rendered a block-level
 * `<div>`, which produced invalid HTML whenever it was nested inside a `<p>`
 * (a real-world case: professor/room text with an inline status badge).
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
