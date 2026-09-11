import * as React from 'react'
import { getCourses } from '@/lib/actions/courses'
import { getProfile } from '@/lib/actions/profile'
import { StatsView } from '@/components/stats/stats-view'

export default async function StatsPage() {
  const [coursesRes, profileRes] = await Promise.all([getCourses(), getProfile()])
  const courses = coursesRes.ok ? coursesRes.data : []
  const profile = profileRes.ok ? profileRes.data : null

  return (
    <StatsView
      courses={courses}
      passingGrade={profile?.passingGrade ?? 3.0}
      maxGrade={profile?.maxGrade ?? 5.0}
    />
  )
}
