import * as React from 'react'
import { getCourses } from '@/lib/actions/courses'
import { getProfile } from '@/lib/actions/profile'
import { NextClassHero } from '@/components/schedule/next-class-hero'
import { QuickStats } from '@/components/stats/quick-stats'
import { ScheduleGrid } from '@/components/schedule/schedule-grid'

export default async function DashboardPage() {
  const [courses, profile] = await Promise.all([getCourses(), getProfile()])

  const preferences = profile?.preferences || {
    timeFormat24h: true,
    weekStartsOn: 'monday',
    gridCompact: false,
  }

  return (
    <div className="space-y-6">
      {/* Top Hero Section: Upcoming Class Countdown */}
      <NextClassHero
        courses={courses}
        timeFormat24h={preferences.timeFormat24h ?? true}
      />

      {/* Quick Stats: Credits, Hours, Enrolled */}
      <QuickStats
        courses={courses}
        passingGrade={profile?.passing_grade ?? 3.0}
        maxGrade={profile?.max_grade ?? 5.0}
      />

      {/* Main Interactive Grid */}
      <ScheduleGrid
        courses={courses}
        timeFormat24h={preferences.timeFormat24h ?? true}
        weekStartsOn={preferences.weekStartsOn ?? 'monday'}
        gridCompact={preferences.gridCompact ?? false}
      />
    </div>
  )
}
