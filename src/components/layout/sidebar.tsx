'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, APP_NAME, BRAND_ICON } from '@/config/nav'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const COLLAPSE_STORAGE_KEY = 'amellify:sidebar-collapsed'

function isActiveHref(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
}

/**
 * Floating glass-chrome sidebar (plan 2.2) — deliberately inset from the
 * viewport edge (`m-3`) rather than edge-to-edge, so it reads as a separate
 * panel floating over `<AmbientBackground/>` instead of a flat sidebar with
 * a hard border.
 */
export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1')
    } catch {
      // localStorage unavailable (private mode, etc.) — default to expanded.
    }
    setHydrated(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'sticky top-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col md:flex',
          'ml-3 transition-[width] duration-[var(--duration-base)] ease-[var(--ease-fluid)]',
          hydrated && collapsed ? 'w-[4.5rem]' : 'w-64'
        )}
      >
        <div className="glass-chrome flex h-full flex-col rounded-2xl p-3">
          {/* Brand */}
          <div className={cn('flex items-center gap-3 px-2 pb-4 pt-1', collapsed && 'justify-center px-0')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BRAND_ICON className="h-5 w-5" />
            </div>
            {(!collapsed || !hydrated) && (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-base font-bold tracking-tight">{APP_NAME}</span>
                <span className="truncate text-[11px] text-muted-foreground">Gestor universitario</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav aria-label="Navegación principal" className="flex-1 space-y-1 overflow-y-auto px-0 py-1">
            {NAV_ITEMS.map((item) => {
              const active = isActiveHref(pathname, item.href)
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'glass-tint-primary text-primary'
                      : 'text-muted-foreground hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {(!collapsed || !hydrated) && <span className="truncate">{item.title}</span>}
                </Link>
              )

              if (!collapsed) return link

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          {/* Footer: collapse toggle + info card */}
          <div className="space-y-2 pt-2">
            {!collapsed && (
              <div className="glass-card rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-accent">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold text-foreground">Autohospedado</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Tus materias y notas viven en tu propio servidor Postgres.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-foreground',
                collapsed && 'justify-center px-0'
              )}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              {!collapsed && <span>Colapsar</span>}
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
