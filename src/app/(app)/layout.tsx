import * as React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { getProfile } from '@/lib/actions/profile'
import { getCourses } from '@/lib/actions/courses'
import { MOCK_PROFILE, MOCK_COURSES } from '@/lib/mock-data'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { CourseWithDetails, Profile } from '@/types/database'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  let user: AuthUser | null = null
  let profile: Profile | null = null
  let courses: CourseWithDetails[] = []

  if (isSupabaseConfigured) {
    try {
      const supabase = await createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      user = authUser

      if (!user) {
        redirect('/login')
      }

      const [dbProfile, dbCourses] = await Promise.all([getProfile(), getCourses()])
      profile = dbProfile
      courses = dbCourses
    } catch (err) {
      console.warn('Error fetching Supabase user, fallback to demo mode:', err)
    }
  }

  // Fallback demo user if not connected yet or in preview mode
  if (!user) {
    user = {
      id: 'demo-user-id',
      app_metadata: {},
      user_metadata: {
        full_name: 'Manuel Amell',
        email: 'manuel@amellify.app',
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as AuthUser
    profile = MOCK_PROFILE
    courses = MOCK_COURSES
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} profile={profile} courses={courses} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
