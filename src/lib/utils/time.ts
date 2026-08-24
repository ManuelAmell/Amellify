import type { DayOfWeek, Schedule, CourseWithDetails } from '@/types/database'

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
]

export const SPANISH_DAY_TO_INDEX: Record<DayOfWeek, number> = {
  Domingo: 0,
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
}

export const JS_DAY_TO_SPANISH: Record<number, DayOfWeek> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

/**
 * Converts "HH:MM" or "HH:MM:SS" to minutes from 00:00
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.split(':')
  const hours = parseInt(parts[0] || '0', 10)
  const minutes = parseInt(parts[1] || '0', 10)
  return hours * 60 + minutes
}

/**
 * Converts minutes from 00:00 to "HH:MM"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Formats time according to 24h or 12h setting
 */
export function formatDisplayTime(timeStr: string, format24h: boolean = true): string {
  if (!timeStr) return ''
  const trimmed = timeStr.substring(0, 5)
  if (format24h) return trimmed

  const [hoursStr, minutesStr] = trimmed.split(':')
  let hours = parseInt(hoursStr || '0', 10)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutesStr} ${ampm}`
}

export interface NextClassInfo {
  course: CourseWithDetails
  schedule: Schedule
  timeUntilMs: number
  isToday: boolean
  isLive: boolean
}

/**
 * Finds the upcoming next class or active ongoing class
 */
export function getNextClass(courses: CourseWithDetails[]): NextClassInfo | null {
  const now = new Date()
  const currentDayIndex = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const allScheduledClasses: { course: CourseWithDetails; schedule: Schedule; dayOffset: number }[] = []

  for (const course of courses) {
    if (course.status !== 'active') continue
    for (const schedule of course.schedules) {
      const scheduleDayIndex = SPANISH_DAY_TO_INDEX[schedule.day]
      let dayOffset = (scheduleDayIndex - currentDayIndex + 7) % 7

      const startMin = timeToMinutes(schedule.start_time)
      const endMin = timeToMinutes(schedule.end_time)

      // If today but class already ended, it's next week (+7 days)
      if (dayOffset === 0 && currentMinutes > endMin) {
        dayOffset = 7
      }

      allScheduledClasses.push({
        course,
        schedule,
        dayOffset,
      })
    }
  }

  if (allScheduledClasses.length === 0) return null

  // Sort by earliest upcoming
  allScheduledClasses.sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset
    return timeToMinutes(a.schedule.start_time) - timeToMinutes(b.schedule.start_time)
  })

  const next = allScheduledClasses[0]
  if (!next) return null

  const startMin = timeToMinutes(next.schedule.start_time)
  const endMin = timeToMinutes(next.schedule.end_time)

  const isToday = next.dayOffset === 0
  const isLive = isToday && currentMinutes >= startMin && currentMinutes <= endMin

  let timeUntilMs = 0
  if (isToday) {
    timeUntilMs = (startMin - currentMinutes) * 60 * 1000
  } else {
    timeUntilMs = (next.dayOffset * 24 * 60 + (startMin - currentMinutes)) * 60 * 1000
  }

  return {
    course: next.course,
    schedule: next.schedule,
    timeUntilMs: Math.max(0, timeUntilMs),
    isToday,
    isLive,
  }
}
