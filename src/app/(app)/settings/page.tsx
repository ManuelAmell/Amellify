import * as React from 'react'
import { getProfile } from '@/lib/actions/profile'
import { getCourses } from '@/lib/actions/courses'
import { SettingsView } from '@/components/settings/settings-view'

export default async function SettingsPage() {
  const [profileRes, coursesRes] = await Promise.all([getProfile(), getCourses()])
  const profile = profileRes.ok ? profileRes.data : null
  const courses = coursesRes.ok ? coursesRes.data : []

  return <SettingsView profile={profile as any} courses={courses} />
}
