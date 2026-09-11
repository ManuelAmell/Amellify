'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/config/nav'

function isActiveHref(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
}

/**
 * Floating glass bottom nav (mobile only). Two plan fixes baked in:
 *  - `pb-safe` doesn't exist in Tailwind (old v2 bug H5); uses the real
 *    `env(safe-area-inset-bottom)` value directly, and the root layout sets
 *    `viewport-fit=cover` so the env() value is non-zero on notched devices.
 *  - Floats with a margin instead of sitting edge-to-edge flush with the
 *    bottom of the screen, consistent with the rest of the "chrome floats
 *    above content" language.
 */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación móvil"
      className="glass-chrome fixed inset-x-3 z-40 flex items-center justify-around rounded-2xl px-1 py-1.5 md:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActiveHref(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="relative flex min-h-[44px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-muted-foreground transition-colors data-[active=true]:text-primary"
            data-active={active}
          >
            {active && (
              <motion.span
                layoutId="bottom-nav-active-pill"
                className="glass-tint-primary rounded-xl"
                // Inline style (not the `absolute`/`inset-1` utilities) so it wins
                // deterministically over glass-tint-primary's own `position:
                // relative` (needed for its ::before border-gradient overlay) —
                // two classes both setting `position` have equal specificity and
                // the cascade winner isn't guaranteed to be the one we want.
                style={{ position: 'absolute', inset: '0.25rem' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <item.icon className={cn('relative z-10 h-5 w-5 transition-transform', active && 'scale-110')} aria-hidden="true" />
            <span className="relative z-10 text-[10px] font-medium">{item.shortTitle}</span>
          </Link>
        )
      })}
    </nav>
  )
}
