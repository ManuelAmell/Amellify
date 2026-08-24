import * as React from 'react'
import { getCourses } from '@/lib/actions/courses'
import { getProfile } from '@/lib/actions/profile'
import { StatsView } from '@/components/stats/stats-view'

export default async function StatsPage() {
  const [courses, profile] = await Promise.all([getCourses(), getProfile()])

  return (
    <StatsView
      courses={courses}
      passingGrade={profile?.passing_grade ?? 3.0}
      maxGrade={profile?.max_grade ?? 5.0}
    />
  )
}
