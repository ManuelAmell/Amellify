'use client'

import * as React from 'react'
import type { CourseWithDetails, DayOfWeek, SubjectColor } from '@/types/database'
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
  AlertTriangle,
} from 'lucide-react'
import { timeToMinutes, DAYS_OF_WEEK } from '@/lib/utils/time'
import { computeWeightedAverage, computeNeededGrade } from '@/lib/utils/grades'
import { SUBJECT_COLOR_CLASSES } from '@/config/subject-colors'
import { cn } from '@/lib/utils'

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

  // Hours per day calculation including Domingo
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
      const day = sched.day as DayOfWeek
      const current = hoursPerDay[day]
      if (end > start && current !== undefined) {
        hoursPerDay[day] = current + (end - start) / 60
      }
    }
  }

  const maxDailyHours = Math.max(1, ...Object.values(hoursPerDay))
  const totalWeeklyHours = Object.values(hoursPerDay).reduce((a, b) => a + b, 0)

  // Calculate average hours per ACTUAL class days (days with hours > 0)
  const daysWithClassesCount = Object.values(hoursPerDay).filter((h) => h > 0).length
  const avgHoursPerClassDay =
    daysWithClassesCount > 0 ? totalWeeklyHours / daysWithClassesCount : 0

  // Performance per course
  const courseMetrics = activeCourses.map((c) => {
    const { average, completedPercent } = computeWeightedAverage(c.partials || [], maxGrade)
    const needed = computeNeededGrade(c.partials || [], passingGrade, maxGrade)
    return {
      course: c,
      average,
      completedPercent,
      isPassing: average >= passingGrade,
      needed,
    }
  })

  const gradedCourses = courseMetrics.filter((ca) => ca.completedPercent > 0)

  // Best course (highest weighted average among graded courses)
  const bestCourse =
    gradedCourses.length > 0
      ? [...gradedCourses].sort((a, b) => b.average - a.average)[0]
      : null

  // Course at risk: lowest average or unachievable / high needed grade
  const failingCourses = gradedCourses.filter((cm) => !cm.isPassing || (cm.needed && !cm.needed.achievable))
  const atRiskCourse =
    gradedCourses.length === 0
      ? null
      : failingCourses.length > 0
        ? [...failingCourses].sort((a, b) => a.average - b.average)[0] ?? null
        : [...gradedCourses].sort((a, b) => a.average - b.average)[0] ?? null

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
          Análisis de carga horaria semanal completa (lunes a domingo), distribución de créditos y
          rendimiento por materia.
        </p>
      </div>

      {/* Top Metrics Row: 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Global Average */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Promedio General</span>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <div className="pt-2">
            <div className="text-2xl font-black text-primary font-mono">
              {globalAverage !== null ? globalAverage.toFixed(2) : '—'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {globalAverage !== null && globalAverage >= passingGrade
                ? '✅ Rendimiento satisfactorio'
                : globalAverage !== null
                ? '⚠️ Requiere atención'
                : 'Sin notas registradas'}
            </p>
          </div>
        </div>

        {/* Metric 2: Total Credits */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Créditos Totales</span>
            <GraduationCap className="h-4 w-4 text-secondary" />
          </div>
          <div className="pt-2">
            <div className="text-2xl font-black text-foreground font-mono">{totalCredits}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              En {activeCourses.length} {activeCourses.length === 1 ? 'materia activa' : 'materias activas'}
            </p>
          </div>
        </div>

        {/* Metric 3: Weekly Hours & Real Class Days */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Carga Semanal</span>
            <Clock className="h-4 w-4 text-accent" />
          </div>
          <div className="pt-2">
            <div className="text-2xl font-black text-accent font-mono">
              {totalWeeklyHours.toFixed(1)} <span className="text-xs font-normal">hrs</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate" title={`${avgHoursPerClassDay.toFixed(1)} hrs/día en ${daysWithClassesCount} días reales con clase`}>
              {daysWithClassesCount > 0
                ? `${avgHoursPerClassDay.toFixed(1)} hrs/día (${daysWithClassesCount}d de clase)`
                : 'Sin clases programadas'}
            </p>
          </div>
        </div>

        {/* Metric 4: Best Course */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Mejor Materia</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="pt-2">
            <div className="text-base font-bold text-foreground truncate" title={bestCourse?.course.name || 'Sin datos'}>
              {bestCourse ? bestCourse.course.name : '—'}
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 font-mono">
              {bestCourse ? `Promedio: ${bestCourse.average.toFixed(2)}` : 'Sin datos'}
            </p>
          </div>
        </div>

        {/* Metric 5: Course at Risk */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Materia en Riesgo</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="pt-2">
            <div
              className="text-base font-bold text-foreground truncate"
              title={atRiskCourse?.course.name || 'Ninguna'}
            >
              {atRiskCourse ? atRiskCourse.course.name : 'Ninguna'}
            </div>
            <p className="text-[11px] font-semibold mt-1 font-mono">
              {atRiskCourse ? (
                atRiskCourse.isPassing ? (
                  <span className="text-amber-500">
                    Menor prom: {atRiskCourse.average.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-destructive">
                    Reprobando: {atRiskCourse.average.toFixed(2)}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">Al día</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Visuals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Schedule Load Bar Chart (Includes Domingo + Accessibility) */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              Carga Horaria Semanal (Lunes a Domingo)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Horas de clase presenciales o virtuales distribuidas por cada día de la semana.
            </p>
          </div>

          <div
            role="img"
            aria-label={`Gráfico de carga horaria semanal. Total: ${totalWeeklyHours.toFixed(1)} horas de clase distribuidas en ${daysWithClassesCount} días.`}
            className="space-y-3 pt-2"
          >
            {DAYS_OF_WEEK.map((day) => {
              const hours = hoursPerDay[day] || 0
              const percent = maxDailyHours > 0 ? (hours / maxDailyHours) * 100 : 0
              const isSunday = day === 'Domingo'

              return (
                <div
                  key={day}
                  className="space-y-1"
                  role="presentation"
                  aria-label={`${day}: ${hours > 0 ? `${hours.toFixed(1)} horas de clase` : 'Día libre'}`}
                >
                  <div className="flex justify-between text-xs">
                    <span className={cn('font-medium', isSunday && 'text-muted-foreground')}>
                      {day}
                      {isSunday && ' (Fin de semana)'}
                    </span>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {hours > 0 ? `${hours.toFixed(1)} hrs` : 'Libre'}
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full glass-inset overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className={cn(
                        'h-full transition-all duration-500 rounded-full',
                        hours > 0
                          ? 'bg-gradient-to-r from-primary to-accent'
                          : 'bg-transparent'
                      )}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Academic Performance by Course */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              Rendimiento por Asignatura
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Promedio ponderado, avance porcentual y estado de cada materia activa.
            </p>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {courseMetrics.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No tienes materias activas registradas.
              </p>
            ) : (
              courseMetrics.map(({ course, average, completedPercent, isPassing, needed }) => {
                const colorKey = (course.color as SubjectColor) || 'blue'
                const colorClass = SUBJECT_COLOR_CLASSES[colorKey] || 'subject-blue'

                return (
                  <div
                    key={course.id}
                    className="p-3 rounded-xl glass-inset flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('subject-dot h-2 w-2 rounded-full shrink-0', colorClass)} />
                        <span className="text-xs font-bold font-mono text-muted-foreground">
                          [{course.code}]
                        </span>
                        <p className="text-xs font-semibold truncate text-foreground">
                          {course.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 max-w-[140px]">
                          <Progress value={completedPercent} className="h-1.5" />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {completedPercent.toFixed(0)}% evaluado
                        </span>
                        {needed && !needed.achievable && (
                          <span className="text-[10px] text-destructive font-medium flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            Meta inalcanzable
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono text-foreground">
                        {completedPercent > 0 ? average.toFixed(2) : '—'}
                      </div>
                      {completedPercent > 0 && (
                        <Badge
                          variant={isPassing ? 'success' : 'destructive'}
                          className="text-[9px] px-1.5 py-0 font-bold"
                        >
                          {isPassing ? 'Aprobando' : 'Riesgo'}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
