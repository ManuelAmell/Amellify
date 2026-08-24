import * as React from 'react'
import { getCourses } from '@/lib/actions/courses'
import { getProfile } from '@/lib/actions/profile'
import { CalculatorView } from '@/components/calculator/calculator-view'

export default async function CalculatorPage() {
  const [courses, profile] = await Promise.all([getCourses(), getProfile()])

  return (
    <CalculatorView
      courses={courses}
      passingGrade={profile?.passing_grade ?? 3.0}
      maxGrade={profile?.max_grade ?? 5.0}
    />
  )
}
