import * as React from 'react'
import { cn } from '@/lib/utils'

export type GlassTier = 'chrome' | 'card' | 'float'

const TIER_CLASS: Record<GlassTier, string> = {
  chrome: 'glass-chrome',
  card: 'glass-card',
  float: 'glass-float',
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which glass tier to render (plan 2.1 glass-{chrome,card,float}). Defaults to `card`. */
  tier?: GlassTier
}

/**
 * `GlassCard` — the default `Card` primitive rendered as a Liquid Glass
 * surface. Pass `tier="chrome"` for floating nav-like panels or `tier="float"`
 * for content that should read as elevated above everything else (popovers
 * embedded inline, hero panels).
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, tier = 'card', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(TIER_CLASS[tier], 'rounded-2xl text-card-foreground', 'motion-safe:animate-glass-in', className)}
    {...props}
  />
))
Card.displayName = 'Card'

/** Alias kept for call sites that want to be explicit about the glass tier. */
const GlassCard = Card

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Heading level to render. Defaults to `h3` for content cards, but stat
   * tiles displaying a bare number should pass `as="p"` or `as="span"` —
   * treating every numeric KPI as a heading was a plan-noted accessibility
   * smell in the old card component.
   */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span'
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Comp = 'h3', ...props }, ref) => (
    <Comp
      ref={ref as React.Ref<HTMLHeadingElement>}
      className={cn('text-lg leading-none font-semibold tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, GlassCard, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
