import * as React from 'react'
import { UserNav } from '@/components/layout/user-nav'
import { CommandSearch } from '@/components/ui/command-search'
import type { Profile, CourseWithDetails } from '@/types/database'
import type { User } from '@supabase/supabase-js'
import { GraduationCap } from 'lucide-react'

interface HeaderProps {
  user: User
  profile: Profile | null
  courses: CourseWithDetails[]
}

export function Header({ user, profile, courses }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/80 px-4 md:px-6 backdrop-blur-xl">
      {/* Mobile Brand / Page Title */}
      <div className="flex items-center gap-3">
        <div className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {profile?.university ? profile.university : 'Amellify'}
          </span>
          {profile?.faculty && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
              {profile.faculty} {profile.current_semester ? `· ${profile.current_semester}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Right Actions: Command Search + User Avatar */}
      <div className="flex items-center gap-3">
        <CommandSearch courses={courses} />
        <UserNav user={user} profile={profile} />
      </div>
    </header>
  )
}
