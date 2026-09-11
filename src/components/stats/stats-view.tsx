'use client'

import * as React from 'react'
import type { CourseWithDetails, DayOfWeek } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart3,
  TrendingUp,
  Clock,
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { timeToMinutes, DAYS_OF_WEEK } from '@/lib/utils/time'
import { computeWeightedAverage } from '@/lib/utils/grades'

interface StatsViewProps {
  courses: CourseWithDetails[]
  passingGrade?: number
  maxGrade?: number
}

export function StatsView({
  courses,
  passingGrade = 3.0,
  maxGrade = 5.0,
}: StatsViewProps) {
  const activeCourses = courses.filter((c) => c.status === 'active')

  // Total credits
  const totalCredits = activeCourses.reduce((sum, c) => sum + (c.credits || 0), 0)

  // Hours per day calculation
  const hoursPerDay: Record<DayOfWeek, number> = {
    Lunes: 0,
    Martes: 0,
    Miércoles: 0,
    Jueves: 0,
    Viernes: 0,
    Sábado: 0,
    Domingo: 0,
  }

  for (const course of activeCourses) {
    for (const sched of course.schedules) {
      const start = timeToMinutes(sched.start_time ?? sched.startTime ?? '')
      const end = timeToMinutes(sched.end_time ?? sched.endTime ?? '')
      const day = sched.day as keyof typeof hoursPerDay
      const current = hoursPerDay[day]
      if (end > start && current !== undefined) {
        hoursPerDay[day] = current + (end - start) / 60
      }
    }
  }

  const maxDailyHours = Math.max(1, ...Object.values(hoursPerDay))
  const totalWeeklyHours = Object.values(hoursPerDay).reduce((a, b) => a + b, 0)

  // Performance per course
  const courseAverages = activeCourses.map((c) => {
    const { average, completedPercent } = computeWeightedAverage(c.partials || [], maxGrade)
    return {
      course: c,
      average,
      completedPercent,
      isPassing: average >= passingGrade,
    }
  })

  const gradedCourses = courseAverages.filter((ca) => ca.completedPercent > 0)
  const bestCourse =
    gradedCourses.length > 0
      ? [...gradedCourses].sort((a, b) => b.average - a.average)[0]
      : null
  const lowestCourse =
    gradedCourses.length > 0
      ? [...gradedCourses].sort((a, b) => a.average - b.average)[0]
      : null

  // Global weighted average
  let totalWeighted = 0
  let totalGradedCredits = 0
  for (const ca of gradedCourses) {
    totalWeighted += ca.average * ca.course.credits
    totalGradedCredits += ca.course.credits
  }
  const globalAverage =
    totalGradedCredits > 0 ? totalWeighted / totalGradedCredits : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Estadísticas & Rendimiento Académico
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Análisis de carga horaria semanal, distribución de créditos y rendimiento por materia.
        </p>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-xs font-semibold uppercase">
              Promedio General
            </CardDescription>
            <Award className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-primary">
              {globalAverage !== null ? globalAverage.toFixed(2) : '—'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {globalAverage !== null && globalAverage >= passingGrade
                ? '✅ Rendimiento satisfactorio'
                : globalAverage !== null
                ? '⚠️ Requiere atención en parciales'
                : 'Sin notas registradas'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-xs font-semibold uppercase">
              Créditos Totales
            </CardDescription>
            <GraduationCap className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-secondary">{totalCredits}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Distribuido en {activeCourses.length} materias activas
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-xs font-semibold uppercase">
              Carga Semanal
            </CardDescription>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-accent">
              {totalWeeklyHours.toFixed(1)} <span className="text-sm font-normal">hrs</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {(totalWeeklyHours / 5).toFixed(1)} hrs promedio por día
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-xs font-semibold uppercase">
              Mejor Rendimiento
            </CardDescription>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-base font-bold text-foreground truncate">
              {bestCourse ? bestCourse.course.name : '—'}
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {bestCourse ? `Promedio: ${bestCourse.average.toFixed(2)}` : 'Sin datos'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Schedule Load Bar Chart */}
        <Card className="glass-panel border-border/80 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Carga Horaria por Día de la Semana
            </CardTitle>
            <CardDescription className="text-xs">
              Horas de clase presencial o virtual distribuidas por día.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            {DAYS_OF_WEEK.slice(0, 6).map((day) => {
              const hours = hoursPerDay[day]
              const percent = (hours / maxDailyHours) * 100
              return (
                <div key={day} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{day}</span>
                    <span className="font-mono text-muted-foreground">
                      {hours > 0 ? `${hours.toFixed(1)} hrs` : 'Libre'}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 rounded-full"
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Academic Performance by Course */}
        <Card className="glass-panel border-border/80 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Rendimiento por Asignatura
            </CardTitle>
            <CardDescription className="text-xs">
              Promedio ponderado y avance porcentual de cada materia.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-3">
            {courseAverages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No tienes materias activas registradas.
              </p>
            ) : (
              courseAverages.map(({ course, average, completedPercent, isPassing }) => (
                <div
                  key={course.id}
                  className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-muted-foreground">
                        [{course.code}]
                      </span>
                      <p className="text-xs font-semibold truncate">{course.name}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {completedPercent.toFixed(0)}% evaluado
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono">
                      {completedPercent > 0 ? average.toFixed(2) : '—'}
                    </div>
                    {completedPercent > 0 && (
                      <Badge
                        variant={isPassing ? 'success' : 'destructive'}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {isPassing ? 'Aprobando' : 'Riesgo'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
