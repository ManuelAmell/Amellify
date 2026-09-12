'use client'

import * as React from 'react'
import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Self-contained avatar (not built on `@radix-ui/react-avatar`): that
 * package's `Image` sub-component renders its own bare `<img>` and doesn't
 * support `asChild`, so it can't host `next/image` — which is the whole
 * point here (plan finding: the old v2 `UserNav` used a raw `<img>` despite
 * `next.config.ts` already listing Google/GitHub avatar hosts in
 * `images.remotePatterns`). Falls back to initials on load error via plain
 * React state instead of Radix's loading-status context.
 */
const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-[color-mix(in_oklch,var(--foreground)_10%,transparent)]',
        className
      )}
      {...props}
    />
  )
)
Avatar.displayName = 'Avatar'

interface AvatarImageProps extends Omit<ImageProps, 'fill' | 'alt'> {
  alt: string
  /** Rendered instead of the image once it fails to load. */
  fallback?: React.ReactNode
}

const AvatarImage = ({ className, fallback, onError, alt, ...props }: AvatarImageProps) => {
  const [errored, setErrored] = React.useState(false)

  if (errored) return <>{fallback}</>

  return (
    <Image
      alt={alt}
      fill
      sizes="36px"
      className={cn('object-cover', className)}
      onError={(e) => {
        setErrored(true)
        onError?.(e)
      }}
      {...props}
    />
  )
}
AvatarImage.displayName = 'AvatarImage'

const AvatarFallback = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary',
        className
      )}
      {...props}
    />
  )
)
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback }
