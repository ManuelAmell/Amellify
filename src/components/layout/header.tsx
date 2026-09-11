'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { UserNav } from '@/components/layout/user-nav'
import { CommandSearch } from '@/components/layout/command-search'
import { NAV_ITEMS, BRAND_ICON } from '@/config/nav'
import type { CourseWithDetails, UserProfile } from '@/types/domain'

interface HeaderProps {
  profile: UserProfile | null
  courses: CourseWithDetails[]
}

function usePageTitle(pathname: string): string {
  const match = NAV_ITEMS.find((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)))
  return match?.title ?? 'Amellify'
}

/**
 * Floating glass-chrome header: page `<h1>` on the left, `CommandSearch` +
 * `UserNav` on the right. Inset from the viewport edge like the sidebar so
 * the two chrome panels read as one continuous floating layer.
 */
export function Header({ profile, courses }: HeaderProps) {
  const pathname = usePathname()
  const title = usePageTitle(pathname)

  return (
    <header className="glass-chrome sticky top-3 z-30 mx-3 flex h-14 items-center justify-between gap-3 rounded-2xl px-4 md:mr-3 md:ml-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground md:hidden">
          <BRAND_ICON className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h1>
          {profile?.university && (
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {profile.university}
              {profile.faculty ? ` · ${profile.faculty}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <CommandSearch courses={courses} />
        <UserNav profile={profile} />
      </div>
    </header>
  )
}
