'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, BookOpen, Calculator, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOBILE_NAV_ITEMS = [
  { title: 'Horario', href: '/dashboard', icon: Calendar },
  { title: 'Materias', href: '/courses', icon: BookOpen },
  { title: 'Notas', href: '/calculator', icon: Calculator },
  { title: 'Stats', href: '/stats', icon: BarChart3 },
  { title: 'Ajustes', href: '/settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación móvil"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card/85 backdrop-blur-lg px-2 pb-safe"
    >
      <div className="flex h-16 items-center justify-around">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-w-[48px] min-h-[44px] px-2 py-1 rounded-lg transition-colors cursor-pointer',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform duration-150',
                  isActive && 'scale-110'
                )}
              />
              <span className="text-[10px] mt-1">{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
