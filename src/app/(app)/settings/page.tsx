import * as React from 'react'
import { getProfile } from '@/lib/actions/profile'
import { getCourses } from '@/lib/actions/courses'
import { SettingsView } from '@/components/settings/settings-view'

export default async function SettingsPage() {
  const [profile, courses] = await Promise.all([getProfile(), getCourses()])

  return <SettingsView profile={profile} courses={courses} />
}
