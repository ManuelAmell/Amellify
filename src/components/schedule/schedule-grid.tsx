'use client'

import * as React from 'react'
import type { CourseWithDetails, DayOfWeek, Schedule } from '@/types/database'
import { DAYS_OF_WEEK, timeToMinutes, formatDisplayTime } from '@/lib/utils/time'
import { ClassBlock } from '@/components/schedule/class-block'
import { TimeMarker } from '@/components/schedule/time-marker'
import { CourseDialog } from '@/components/courses/course-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduleGridProps {
  courses: CourseWithDetails[]
  timeFormat24h?: boolean
  weekStartsOn?: 'monday' | 'sunday'
  gridCompact?: boolean
}

export function ScheduleGrid({
  courses,
  timeFormat24h = true,
  weekStartsOn = 'monday',
  gridCompact = false,
}: ScheduleGridProps) {
  const [selectedCourse, setSelectedCourse] = React.useState<CourseWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newSlotDefaults, setNewSlotDefaults] = React.useState<{
    day?: DayOfWeek
    start_time?: string
    end_time?: string
  }>({})
  const [includeWeekends, setIncludeWeekends] = React.useState(false)

  // Check if any active course is on Saturday or Sunday
  React.useEffect(() => {
    const hasWeekendClasses = courses.some((c) =>
      c.schedules.some((s) => s.day === 'Sábado' || s.day === 'Domingo')
    )
    if (hasWeekendClasses) {
      setIncludeWeekends(true)
    }
  }, [courses])

  // Determine active days
  const activeDays: DayOfWeek[] = React.useMemo(() => {
    if (includeWeekends) {
      return weekStartsOn === 'sunday'
        ? ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    }
    return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
  }, [includeWeekends, weekStartsOn])

  // Dynamic or standard hour range (6:00 to 22:00)
  const startHour = 6
  const endHour = 22
  const totalHours = endHour - startHour
  const slotHeightPx = gridCompact ? 42 : 56

  const hoursArray = Array.from({ length: totalHours }, (_, i) => startHour + i)

  const handleCellClick = (day: DayOfWeek, hour: number) => {
    const startStr = `${hour.toString().padStart(2, '0')}:00`
    const endStr = `${(hour + 2).toString().padStart(2, '0')}:00`
    setNewSlotDefaults({
      day,
      start_time: startStr,
      end_time: endStr,
    })
    setSelectedCourse(null)
    setDialogOpen(true)
  }

  const handleCourseClick = (course: CourseWithDetails) => {
    setSelectedCourse(course)
    setDialogOpen(true)
  }

  const handleCreateNew = () => {
    setSelectedCourse(null)
    setNewSlotDefaults({})
    setDialogOpen(true)
  }

  return (
    <div className="space-y-3">
      {/* Grid Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-base tracking-tight text-foreground">
            Horario Semanal
          </h3>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            · {courses.filter((c) => c.status === 'active').length} materias activas
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeWeekends(!includeWeekends)}
            className="h-8 text-xs cursor-pointer"
          >
            {includeWeekends ? 'Ocultar Fines de Semana' : 'Mostrar Fines de Semana'}
          </Button>

          <Button
            onClick={handleCreateNew}
            size="sm"
            className="h-8 text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva Materia
          </Button>
        </div>
      </div>

      {/* Main Interactive Grid Container */}
      <div className="rounded-2xl border bg-card/70 shadow-sm backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <div
            style={{ minWidth: `${Math.max(650, activeDays.length * 130 + 60)}px` }}
            className="w-full relative select-none"
          >
            {/* Days Header */}
            <div className="sticky top-0 z-20 flex border-b bg-card/90 backdrop-blur-md">
              {/* Time gutter header */}
              <div className="w-16 shrink-0 p-3 text-center border-r text-[11px] font-semibold text-muted-foreground">
                Hora
              </div>

              {/* Day column headers */}
              <div className="flex-1 grid grid-flow-col auto-cols-fr">
                {activeDays.map((day) => (
                  <div
                    key={day}
                    className="p-3 text-center border-r last:border-r-0 text-xs font-bold text-foreground tracking-tight"
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            {/* Grid Body */}
            <div className="relative flex" style={{ height: `${totalHours * slotHeightPx}px` }}>
              {/* Time Gutter Column */}
              <div className="w-16 shrink-0 border-r bg-muted/10 relative">
                {hoursArray.map((hour, idx) => (
                  <div
                    key={hour}
                    style={{ top: `${idx * slotHeightPx}px`, height: `${slotHeightPx}px` }}
                    className="absolute left-0 right-0 flex items-start justify-center pt-1 border-b border-border/30 text-[10px] font-mono text-muted-foreground"
                  >
                    {formatDisplayTime(`${hour.toString().padStart(2, '0')}:00`, timeFormat24h)}
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              <div className="flex-1 grid grid-flow-col auto-cols-fr relative">
                {/* Horizontal Hour Lines across all days */}
                {hoursArray.map((hour, idx) => (
                  <div
                    key={hour}
                    style={{ top: `${idx * slotHeightPx}px` }}
                    className="absolute left-0 right-0 h-px border-b border-border/30 pointer-events-none z-0"
                  />
                ))}

                {/* Day Columns with click handlers and class blocks */}
                {activeDays.map((day, dayIndex) => {
                  // Find all classes on this day
                  const daySchedules: { course: CourseWithDetails; schedule: Schedule }[] = []
                  for (const course of courses) {
                    if (course.status !== 'active') continue
                    for (const sched of course.schedules) {
                      if (sched.day === day) {
                        daySchedules.push({ course, schedule: sched })
                      }
                    }
                  }

                  return (
                    <div
                      key={day}
                      className="relative border-r last:border-r-0 h-full group"
                    >
                      {/* Live Time Indicator */}
                      <TimeMarker
                        startHour={startHour}
                        endHour={endHour}
                        slotHeightPx={slotHeightPx}
                        activeDays={activeDays}
                      />

                      {/* Clickable Hour Cells for Adding Courses */}
                      {hoursArray.map((hour, idx) => (
                        <div
                          key={hour}
                          onClick={() => handleCellClick(day, hour)}
                          style={{
                            top: `${idx * slotHeightPx}px`,
                            height: `${slotHeightPx}px`,
                          }}
                          className="absolute left-0 right-0 hover:bg-primary/5 cursor-pointer transition-colors"
                          title={`Hacer clic para agregar clase el ${day} a las ${hour}:00`}
                        />
                      ))}

                      {/* Class Blocks */}
                      {daySchedules.map(({ course, schedule }) => {
                        const startMinutes = timeToMinutes(schedule.start_time ?? schedule.startTime ?? '')
                        const endMinutes = timeToMinutes(schedule.end_time ?? schedule.endTime ?? '')
                        const gridStartMinutes = startHour * 60

                        const topOffsetMinutes = Math.max(0, startMinutes - gridStartMinutes)
                        const durationMinutes = Math.max(30, endMinutes - startMinutes)

                        const topPx = (topOffsetMinutes / 60) * slotHeightPx
                        const heightPx = (durationMinutes / 60) * slotHeightPx

                        return (
                          <ClassBlock
                            key={`${course.id}-${schedule.id || schedule.start_time}`}
                            course={course}
                            schedule={schedule}
                            topPx={topPx}
                            heightPx={heightPx}
                            timeFormat24h={timeFormat24h}
                            onClick={() => handleCourseClick(course)}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Dialog Modal */}
      <CourseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialCourse={selectedCourse}
        defaultDay={newSlotDefaults.day}
        defaultStartTime={newSlotDefaults.start_time}
        defaultEndTime={newSlotDefaults.end_time}
      />
    </div>
  )
}
