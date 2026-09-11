'use client'

import * as React from 'react'
import type { CourseWithDetails, DayOfWeek, Schedule } from '@/types/database'
import type { SubjectColor } from '@/types/domain'
import {
  timeToMinutes,
  formatDisplayTime,
  DEFAULT_TIMEZONE,
  getZonedParts,
  JS_DAY_TO_SPANISH,
} from '@/lib/utils/time'
import { packOverlappingIntervals } from '@/lib/utils/overlap'
import { ClassBlock } from '@/components/schedule/class-block'
import { TimeMarker } from '@/components/schedule/time-marker'
import { CourseDialog } from '@/components/courses/course-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User } from 'lucide-react'
import { SUBJECT_COLOR_CLASSES } from '@/config/subject-colors'
import { cn } from '@/lib/utils'

export interface ScheduleGridProps {
  courses: CourseWithDetails[]
  timeFormat24h?: boolean
  weekStartsOn?: 'monday' | 'sunday'
  gridCompact?: boolean
  timezone?: string
}

export function ScheduleGrid({
  courses,
  timeFormat24h = true,
  weekStartsOn = 'monday',
  gridCompact = false,
  timezone = DEFAULT_TIMEZONE,
}: ScheduleGridProps) {
  const [selectedCourse, setSelectedCourse] = React.useState<CourseWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newSlotDefaults, setNewSlotDefaults] = React.useState<{
    day?: DayOfWeek
    start_time?: string
    end_time?: string
  }>({})
  const [includeWeekends, setIncludeWeekends] = React.useState(false)
  const [mobileView, setMobileView] = React.useState<'day' | 'week'>('day')

  // Detect current day in user timezone
  const currentSpanishDay: DayOfWeek = React.useMemo(() => {
    const { dayIndex } = getZonedParts(new Date(), timezone)
    return JS_DAY_TO_SPANISH[dayIndex] || 'Lunes'
  }, [timezone])

  // Automatically show weekends if active courses exist on Saturday or Sunday
  React.useEffect(() => {
    const hasWeekendClasses = courses.some((c) =>
      c.status === 'active' &&
      c.schedules.some((s) => s.day === 'Sábado' || s.day === 'Domingo')
    )
    if (hasWeekendClasses) {
      setIncludeWeekends(true)
    }
  }, [courses])

  // Determine active visible days
  const activeDays: DayOfWeek[] = React.useMemo(() => {
    if (includeWeekends) {
      return weekStartsOn === 'sunday'
        ? ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    }
    return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
  }, [includeWeekends, weekStartsOn])

  // Mobile selected day for Day/Agenda view: raw user intent (only changed
  // by explicit clicks below). `activeDays` can shrink after mount (e.g.
  // toggling weekends off while a weekend day is selected), so every read
  // below goes through `selectedMobileDay` clamped to the current
  // `activeDays` rather than re-syncing this state in an effect.
  const [selectedMobileDay, setSelectedMobileDay] = React.useState<DayOfWeek>(() => {
    return activeDays.includes(currentSpanishDay) ? currentSpanishDay : activeDays[0] || 'Lunes'
  })
  const displayedMobileDay: DayOfWeek = activeDays.includes(selectedMobileDay)
    ? selectedMobileDay
    : activeDays[0] || 'Lunes'

  // Dynamic Hour Range: min & max with margin ±1h, bounds [5, 23], default [6, 22]
  const { startHour, endHour } = React.useMemo(() => {
    let minH = Infinity
    let maxH = -Infinity

    for (const course of courses) {
      if (course.status !== 'active') continue
      for (const schedule of course.schedules) {
        const start = schedule.startTime ?? schedule.start_time
        const end = schedule.endTime ?? schedule.end_time
        if (start) {
          const h = Math.floor(timeToMinutes(start) / 60)
          if (h < minH) minH = h
        }
        if (end) {
          const h = Math.ceil(timeToMinutes(end) / 60)
          if (h > maxH) maxH = h
        }
      }
    }

    if (minH === Infinity || maxH === -Infinity) {
      return { startHour: 6, endHour: 22 }
    }

    const calculatedStart = Math.max(5, Math.min(22, minH - 1))
    const calculatedEnd = Math.min(23, Math.max(calculatedStart + 2, maxH + 1))
    return { startHour: calculatedStart, endHour: calculatedEnd }
  }, [courses])

  const totalHours = endHour - startHour
  const slotHeightPx = gridCompact ? 44 : 58
  const hoursArray = Array.from({ length: totalHours }, (_, i) => startHour + i)

  // Column packing for each day: lanes prevent blocks from stacking/covering each other (bug H2)
  const dayPackedBlocks = React.useMemo(() => {
    const map = new Map<
      DayOfWeek,
      Array<{
        course: CourseWithDetails
        schedule: Schedule
        lane: number
        laneCount: number
        topPx: number
        heightPx: number
      }>
    >()

    for (const day of activeDays) {
      const dayEntries: { course: CourseWithDetails; schedule: Schedule }[] = []
      for (const course of courses) {
        if (course.status !== 'active') continue
        for (const s of course.schedules) {
          if (s.day === day) {
            dayEntries.push({ course, schedule: s })
          }
        }
      }

      const packed = packOverlappingIntervals(
        dayEntries,
        (entry) => timeToMinutes(entry.schedule.startTime ?? entry.schedule.start_time ?? ''),
        (entry) => timeToMinutes(entry.schedule.endTime ?? entry.schedule.end_time ?? '')
      )

      const gridStartMinutes = startHour * 60

      const blocks = packed.map(({ item, lane, laneCount }) => {
        const startMinutes = timeToMinutes(
          item.schedule.startTime ?? item.schedule.start_time ?? ''
        )
        const endMinutes = timeToMinutes(item.schedule.endTime ?? item.schedule.end_time ?? '')

        const topOffsetMinutes = Math.max(0, startMinutes - gridStartMinutes)
        const durationMinutes = Math.max(25, endMinutes - startMinutes)

        const topPx = (topOffsetMinutes / 60) * slotHeightPx
        const heightPx = (durationMinutes / 60) * slotHeightPx

        return {
          course: item.course,
          schedule: item.schedule,
          lane,
          laneCount,
          topPx,
          heightPx,
        }
      })

      map.set(day, blocks)
    }

    return map
  }, [activeDays, courses, startHour, slotHeightPx])

  // Classes for the currently selected mobile day (sorted by start time)
  const mobileDayClasses = React.useMemo(() => {
    const list: { course: CourseWithDetails; schedule: Schedule }[] = []
    for (const course of courses) {
      if (course.status !== 'active') continue
      for (const s of course.schedules) {
        if (s.day === displayedMobileDay) {
          list.push({ course, schedule: s })
        }
      }
    }
    list.sort((a, b) => {
      const startA = timeToMinutes(a.schedule.startTime ?? a.schedule.start_time ?? '')
      const startB = timeToMinutes(b.schedule.startTime ?? b.schedule.start_time ?? '')
      return startA - startB
    })
    return list
  }, [courses, displayedMobileDay])

  const handleCellClick = (day: DayOfWeek, hour: number) => {
    const startStr = `${hour.toString().padStart(2, '0')}:00`
    const endStr = `${Math.min(23, hour + 2).toString().padStart(2, '0')}:00`
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

  const handlePrevDay = () => {
    const currIndex = activeDays.indexOf(displayedMobileDay)
    if (currIndex > 0) {
      setSelectedMobileDay(activeDays[currIndex - 1]!)
    } else {
      setSelectedMobileDay(activeDays[activeDays.length - 1]!)
    }
  }

  const handleNextDay = () => {
    const currIndex = activeDays.indexOf(displayedMobileDay)
    if (currIndex < activeDays.length - 1) {
      setSelectedMobileDay(activeDays[currIndex + 1]!)
    } else {
      setSelectedMobileDay(activeDays[0]!)
    }
  }

  return (
    <div className="space-y-3">
      {/* Grid Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-base tracking-tight text-foreground">Horario Semanal</h3>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            · {courses.filter((c) => c.status === 'active').length} materias activas
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Segmented Control (Semana / Día) */}
          <div className="flex md:hidden items-center p-1 rounded-xl bg-muted/60 border border-border/50">
            <button
              type="button"
              onClick={() => setMobileView('day')}
              className={cn(
                'py-1 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                mobileView === 'day'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setMobileView('week')}
              className={cn(
                'py-1 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                mobileView === 'week'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Semana
            </button>
          </div>

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
            className="h-8 text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva Materia
          </Button>
        </div>
      </div>

      {/* MOBILE AGENDA VIEW (< md and mobileView === 'day') */}
      <div className={cn('space-y-3 md:hidden', mobileView === 'day' ? 'block' : 'hidden')}>
        {/* Day Navigator Bar */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-2xl border bg-card/80 backdrop-blur-md shadow-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            className="h-8 w-8 cursor-pointer"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Day selection pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            {activeDays.map((day) => {
              const isSelected = day === displayedMobileDay
              const isToday = day === currentSpanishDay
              const dayBlocksCount = dayPackedBlocks.get(day)?.length || 0

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedMobileDay(day)}
                  className={cn(
                    'relative px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : isToday
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <span>{day.substring(0, 3)}</span>
                  {dayBlocksCount > 0 && (
                    <span
                      className={cn(
                        'text-[10px] px-1 py-0.2 rounded-full font-mono font-bold',
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      {dayBlocksCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            className="h-8 w-8 cursor-pointer"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected Day Agenda Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-bold text-foreground">
              {displayedMobileDay}
              {displayedMobileDay === currentSpanishDay && (
                <span className="ml-2 text-xs text-primary font-normal">(Hoy)</span>
              )}
            </h4>
            <span className="text-xs text-muted-foreground">
              {mobileDayClasses.length} {mobileDayClasses.length === 1 ? 'clase' : 'clases'}
            </span>
          </div>

          {mobileDayClasses.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center border border-dashed border-border/60">
              <p className="text-sm font-medium text-foreground">
                Sin clases programadas para el {displayedMobileDay}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Puedes añadir un nuevo bloque de clase para este día.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCellClick(displayedMobileDay, 8)}
                className="text-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar clase el {displayedMobileDay}
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {mobileDayClasses.map(({ course, schedule }) => {
                const colorKey = (course.color || 'blue') as SubjectColor
                const colorClass = SUBJECT_COLOR_CLASSES[colorKey] || 'subject-blue'
                const startStr = formatDisplayTime(
                  schedule.startTime ?? schedule.start_time ?? '',
                  timeFormat24h
                )
                const endStr = formatDisplayTime(
                  schedule.endTime ?? schedule.end_time ?? '',
                  timeFormat24h
                )

                return (
                  <button
                    key={`${course.id}-${schedule.id || schedule.startTime || schedule.start_time}`}
                    type="button"
                    onClick={() => handleCourseClick(course)}
                    aria-label={`${course.name}, ${schedule.day} ${startStr} a ${endStr}${schedule.room ? `, Salón ${schedule.room}` : ''}`}
                    style={{
                      background:
                        'color-mix(in oklch, var(--subject, var(--primary)) 14%, var(--glass-bg, rgba(255, 255, 255, 0.75)))',
                      borderColor: 'color-mix(in oklch, var(--subject, var(--primary)) 40%, transparent)',
                    }}
                    className={cn(
                      'w-full text-left rounded-2xl border p-4 transition-all duration-150 backdrop-blur-md cursor-pointer select-none',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:brightness-105 active:scale-[0.99]',
                      colorClass
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            [{course.code}]
                          </span>
                          <span className="text-xs font-mono font-medium opacity-80 text-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {startStr} - {endStr}
                          </span>
                        </div>
                        <h5 className="font-bold text-sm text-foreground">{course.name}</h5>
                      </div>
                    </div>

                    {(schedule.room || course.professor) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 mt-2 border-t border-current/15">
                        {schedule.room && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <MapPin className="h-3 w-3 opacity-80" />
                            Salón {schedule.room}
                          </span>
                        )}
                        {course.professor && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 opacity-80" />
                            {course.professor}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* WEEKLY GRID VIEW (always shown on md+, and on < md when mobileView === 'week') */}
      <div className={cn(mobileView === 'week' ? 'block' : 'hidden md:block')}>
        <div className="rounded-2xl border bg-card/70 shadow-sm backdrop-blur-md overflow-hidden">
          {/* Scroll container with sticky support */}
          <div className="overflow-auto max-h-[76vh] relative scrollbar-thin">
            <div
              style={{ minWidth: `${Math.max(680, activeDays.length * 135 + 64)}px` }}
              className="w-full relative select-none"
            >
              {/* Sticky Days Header during vertical scroll */}
              <div className="sticky top-0 z-40 flex border-b bg-card/95 backdrop-blur-md shadow-xs">
                {/* Time gutter header cell (sticky left-0 and top-0) */}
                <div className="sticky left-0 z-50 w-16 shrink-0 p-3 text-center border-r bg-card/95 backdrop-blur-md text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Hora
                </div>

                {/* Day column headers */}
                <div className="flex-1 grid grid-flow-col auto-cols-fr">
                  {activeDays.map((day) => {
                    const isToday = currentSpanishDay === day
                    return (
                      <div
                        key={day}
                        className={cn(
                          'p-3 text-center border-r last:border-r-0 text-xs font-bold tracking-tight transition-colors',
                          isToday ? 'bg-primary/10 text-primary' : 'text-foreground'
                        )}
                      >
                        <span>{day}</span>
                        {isToday && (
                          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Grid Body */}
              <div className="relative flex" style={{ height: `${totalHours * slotHeightPx}px` }}>
                {/* Time Gutter Column (sticky left-0 on horizontal scroll) */}
                <div className="sticky left-0 z-30 w-16 shrink-0 border-r bg-card/90 backdrop-blur-md relative">
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

                {/* Day Columns relative container */}
                <div className="flex-1 grid grid-flow-col auto-cols-fr relative">
                  {/* Horizontal Hour grid lines */}
                  {hoursArray.map((hour, idx) => (
                    <div
                      key={hour}
                      style={{ top: `${idx * slotHeightPx}px` }}
                      className="absolute left-0 right-0 h-px border-b border-border/30 pointer-events-none z-0"
                    />
                  ))}

                  {/* Single TimeMarker mounted ONCE at grid level (bug H1) */}
                  <TimeMarker
                    startHour={startHour}
                    endHour={endHour}
                    slotHeightPx={slotHeightPx}
                    activeDays={activeDays}
                    timezone={timezone}
                  />

                  {/* Day Columns with click handlers and packed class blocks (bug H2) */}
                  {activeDays.map((day) => {
                    const blocks = dayPackedBlocks.get(day) || []
                    const isToday = currentSpanishDay === day

                    return (
                      <div
                        key={day}
                        className={cn(
                          'relative border-r last:border-r-0 h-full group',
                          isToday && 'bg-primary/[0.02]'
                        )}
                      >
                        {/* Clickable Hour Cells for adding courses */}
                        {hoursArray.map((hour, idx) => (
                          <button
                            type="button"
                            key={hour}
                            onClick={() => handleCellClick(day, hour)}
                            style={{
                              top: `${idx * slotHeightPx}px`,
                              height: `${slotHeightPx}px`,
                            }}
                            className="absolute left-0 right-0 hover:bg-primary/5 cursor-pointer transition-colors w-full text-left"
                            title={`Hacer clic para agregar clase el ${day} a las ${hour}:00`}
                            aria-label={`Agregar clase el ${day} a las ${hour}:00`}
                          />
                        ))}

                        {/* Parallel Lanes / Overlapping Class Blocks */}
                        {blocks.map((block) => (
                          <ClassBlock
                            key={`${block.course.id}-${block.schedule.id || block.schedule.startTime || block.schedule.start_time}`}
                            course={block.course}
                            schedule={block.schedule}
                            topPx={block.topPx}
                            heightPx={block.heightPx}
                            lane={block.lane}
                            laneCount={block.laneCount}
                            timeFormat24h={timeFormat24h}
                            onClick={() => handleCourseClick(block.course)}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
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
        existingCourses={courses}
        defaultDay={newSlotDefaults.day}
        defaultStartTime={newSlotDefaults.start_time}
        defaultEndTime={newSlotDefaults.end_time}
      />
    </div>
  )
}
