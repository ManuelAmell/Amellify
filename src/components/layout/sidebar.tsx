'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  BookOpen,
  Calculator,
  BarChart3,
  Settings,
  GraduationCap,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  {
    title: 'Horario',
    href: '/dashboard',
    icon: Calendar,
  },
  {
    title: 'Materias',
    href: '/courses',
    icon: BookOpen,
  },
  {
    title: 'Calculadora',
    href: '/calculator',
    icon: Calculator,
  },
  {
    title: 'Estadísticas',
    href: '/stats',
    icon: BarChart3,
  },
  {
    title: 'Configuración',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-card/60 backdrop-blur-xl shrink-0">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 px-6 border-b">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold tracking-tight text-base flex items-center gap-1.5">
            Amellify
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              v2
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">Gestor Universitario</span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </div>

      {/* Pro Badge Card */}
      <div className="p-4 border-t border-border/50">
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 border border-primary/20 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold">Sincronización Cloud</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Tus materias y notas se guardan automáticamente en Supabase PostgreSQL.
          </p>
        </div>
      </div>
    </aside>
  )
}
