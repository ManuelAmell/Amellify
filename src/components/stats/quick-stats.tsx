import * as React from 'react'
import type { CourseWithDetails } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Award, Clock, GraduationCap } from 'lucide-react'
import { timeToMinutes } from '@/lib/utils/time'
import { computeWeightedAverage } from '@/lib/utils/grades'

interface QuickStatsProps {
  courses: CourseWithDetails[]
  passingGrade?: number
  maxGrade?: number
}

export function QuickStats({ courses, passingGrade = 3.0, maxGrade = 5.0 }: QuickStatsProps) {
  const activeCourses = courses.filter((c) => c.status === 'active')

  const totalCredits = activeCourses.reduce((sum, c) => sum + (c.credits || 0), 0)

  // Calculate total weekly hours in classes
  let totalWeeklyMinutes = 0
  for (const course of activeCourses) {
    for (const sched of course.schedules) {
      const start = timeToMinutes(sched.start_time)
      const end = timeToMinutes(sched.end_time)
      if (end > start) {
        totalWeeklyMinutes += end - start
      }
    }
  }
  const weeklyHours = Math.round((totalWeeklyMinutes / 60) * 10) / 10

  // Calculate global weighted average
  let totalWeightedPoints = 0
  let totalGradedCredits = 0

  for (const course of activeCourses) {
    if (course.partials && course.partials.length > 0) {
      const { average, completedPercent } = computeWeightedAverage(course.partials, maxGrade)
      if (completedPercent > 0) {
        totalWeightedPoints += average * course.credits
        totalGradedCredits += course.credits
      }
    }
  }

  const globalAverage =
    totalGradedCredits > 0
      ? Math.round((totalWeightedPoints / totalGradedCredits) * 100) / 100
      : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Active Courses */}
      <Card className="glass-panel border-border/60 shadow-xs hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-medium block truncate">
              Materias Activas
            </span>
            <span className="text-xl font-bold tracking-tight text-foreground">
              {activeCourses.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Credits */}
      <Card className="glass-panel border-border/60 shadow-xs hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-medium block truncate">
              Créditos Inscritos
            </span>
            <span className="text-xl font-bold tracking-tight text-foreground">
              {totalCredits} <span className="text-xs font-normal text-muted-foreground">pts</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Hours */}
      <Card className="glass-panel border-border/60 shadow-xs hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-medium block truncate">
              Horas Semanales
            </span>
            <span className="text-xl font-bold tracking-tight text-foreground">
              {weeklyHours} <span className="text-xs font-normal text-muted-foreground">hrs</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Global Average */}
      <Card className="glass-panel border-border/60 shadow-xs hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              globalAverage !== null && globalAverage >= passingGrade
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-primary/10 text-primary'
            }`}
          >
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-medium block truncate">
              Promedio General
            </span>
            <span className="text-xl font-bold tracking-tight text-foreground">
              {globalAverage !== null ? (
                <>
                  {globalAverage.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">/ {maxGrade}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground font-normal">Sin notas</span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
