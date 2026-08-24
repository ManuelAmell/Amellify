import * as React from 'react'
import { getCourses } from '@/lib/actions/courses'
import { getProfile } from '@/lib/actions/profile'
import { CoursesView } from '@/components/courses/courses-view'

export default async function CoursesPage() {
  const [courses, profile] = await Promise.all([getCourses(), getProfile()])

  return (
    <CoursesView
      initialCourses={courses}
      timeFormat24h={profile?.preferences?.timeFormat24h ?? true}
    />
  )
}
