import * as React from 'react'
import { getCourses } from '@/lib/actions/courses'
import { getProfile } from '@/lib/actions/profile'
import { CoursesView } from '@/components/courses/courses-view'

export default async function CoursesPage() {
  const [coursesRes, profileRes] = await Promise.all([getCourses(), getProfile()])
  const courses = coursesRes.ok ? coursesRes.data : []
  const profile = profileRes.ok ? profileRes.data : null

  return (
    <CoursesView
      initialCourses={courses}
      timeFormat24h={profile?.preferences?.timeFormat24h ?? true}
    />
  )
}
