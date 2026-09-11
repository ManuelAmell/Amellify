import * as React from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { requireUser } from '@/lib/auth/session'
import { getCourses } from '@/lib/actions/courses'
import { getProfile } from '@/lib/actions/profile'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // `requireUser()` must stay OUTSIDE any try/catch (plan finding C2: redirects on missing session).
  await requireUser()
  const [coursesRes, profileRes] = await Promise.all([getCourses(), getProfile()])

  const courses = coursesRes.ok ? coursesRes.data : []
  const profile = profileRes.ok ? profileRes.data : null

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header profile={profile} courses={courses} />
        <main className="flex-1 px-3 pb-28 pt-4 md:pb-6">
          <div className="mx-auto w-full max-w-7xl space-y-6 motion-safe:animate-glass-in">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
