import type { CourseWithDetails, DayOfWeek, Schedule } from '@/types/domain'

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

/** Default IANA timezone, mirrors `UserPreferences.timezone`'s default (plan H3/domain.ts). */
export const DEFAULT_TIMEZONE = 'America/Bogota'

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Converts "HH:MM" or "HH:MM:SS" to minutes from 00:00.
 *
 * Fixes plan finding: the old implementation did not validate ranges, so
 * `"25:99"` silently produced `25*60+99 = 1599`, which then contaminated
 * sorts/comparisons downstream. Out-of-range hours/minutes are now clamped
 * to the nearest valid value (0-23 / 0-59) instead of propagating garbage.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const match = /^(\d{1,2}):(\d{1,2})/.exec(timeStr.trim())
  if (!match) return 0
  const hours = clamp(parseInt(match[1] ?? '0', 10), 0, 23)
  const minutes = clamp(parseInt(match[2] ?? '0', 10), 0, 59)
  return hours * 60 + minutes
}

/**
 * Converts minutes from 00:00 to "HH:MM". `minutes` is clamped to a single
 * day's range (0-1439) so callers can't produce "25:30"-style output.
 */
export function minutesToTime(minutes: number, format24h: boolean = true): string {
  const clamped = clamp(Math.round(minutes), 0, 24 * 60 - 1)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  const time24 = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  return format24h ? time24 : formatDisplayTime(time24, false)
}

/**
 * Formats time according to 24h or 12h setting.
 */
export function formatDisplayTime(
  timeStr: string,
  format24h: boolean = true,
  _includeSeconds: boolean = false
): string {
  if (!timeStr) return ''
  const trimmed = timeStr.substring(0, 5)
  if (format24h) return trimmed

  const [hoursStr, minutesStr] = trimmed.split(':')
  let hours = parseInt(hoursStr || '0', 10)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutesStr} ${ampm}`
}

interface ZonedParts {
  year: number
  month: number // 1-12
  day: number
  /** 0 = Sunday ... 6 = Saturday, matching `Date#getDay()`/`SPANISH_DAY_TO_INDEX`. */
  dayIndex: number
  /** Seconds since local midnight in `timeZone`, including the seconds component. */
  secondsOfDay: number
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/**
 * Reads the wall-clock date/time for `date` as observed in `timeZone`,
 * using `Intl.DateTimeFormat` — no `date-fns-tz` dependency needed (plan
 * finding: acceptable per Fase 1 instructions when the extra package isn't
 * installed).
 */
export function getZonedParts(date: Date, timeZone: string = DEFAULT_TIMEZONE): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const dayIndex = WEEKDAY_TO_INDEX[map.weekday ?? 'Sun'] ?? 0
  const hour = parseInt(map.hour ?? '0', 10) % 24 // some locales render midnight as "24"
  const minute = parseInt(map.minute ?? '0', 10)
  const second = parseInt(map.second ?? '0', 10)
  return {
    year: parseInt(map.year ?? '1970', 10),
    month: parseInt(map.month ?? '1', 10),
    day: parseInt(map.day ?? '1', 10),
    dayIndex,
    secondsOfDay: hour * 3600 + minute * 60 + second,
  }
}

export interface NextClassInfo {
  course: CourseWithDetails
  schedule: Schedule
  timeUntilMs: number
  isToday: boolean
  isLive: boolean
}

export interface GetNextClassOptions {
  /** IANA timezone; defaults to `DEFAULT_TIMEZONE` (plan: `preferences.timezone`). */
  timezone?: string
  /** Injectable clock for tests. */
  now?: Date
}

/**
 * Finds the upcoming next class or currently-ongoing class.
 *
 * Fixes plan finding H3: the old implementation computed `timeUntilMs` from
 * whole minutes only (`now.getHours()*60 + now.getMinutes()`), so the
 * countdown was always a multiple of 60000ms — a 1s `setInterval` in the UI
 * therefore always displayed "0s" and only visibly changed once a minute.
 * This version computes the difference using real seconds-of-day (via
 * `getZonedParts`), so per-second countdowns are accurate, and it is
 * timezone-aware instead of relying on the server process's local clock.
 */
export function getNextClass(
  courses: CourseWithDetails[],
  options: GetNextClassOptions = {}
): NextClassInfo | null {
  const timezone = options.timezone ?? DEFAULT_TIMEZONE
  const now = options.now ?? new Date()
  const { dayIndex: currentDayIndex, secondsOfDay: currentSeconds } = getZonedParts(now, timezone)

  const candidates: { course: CourseWithDetails; schedule: Schedule; dayOffset: number }[] = []

  for (const course of courses) {
    if (course.status !== 'active') continue
    for (const schedule of course.schedules) {
      const scheduleDayIndex = SPANISH_DAY_TO_INDEX[schedule.day]
      let dayOffset = (scheduleDayIndex - currentDayIndex + 7) % 7

      const endSeconds = timeToMinutes(schedule.endTime) * 60

      // If today but the class already ended, it's next week.
      if (dayOffset === 0 && currentSeconds > endSeconds) {
        dayOffset = 7
      }

      candidates.push({ course, schedule, dayOffset })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset
    return timeToMinutes(a.schedule.startTime) - timeToMinutes(b.schedule.startTime)
  })

  const next = candidates[0]
  if (!next) return null

  const startSeconds = timeToMinutes(next.schedule.startTime) * 60
  const endSeconds = timeToMinutes(next.schedule.endTime) * 60

  const isToday = next.dayOffset === 0
  const isLive = isToday && currentSeconds >= startSeconds && currentSeconds <= endSeconds

  const timeUntilMs = Math.max(
    0,
    (next.dayOffset * 24 * 3600 + (startSeconds - currentSeconds)) * 1000
  )

  return {
    course: next.course,
    schedule: next.schedule,
    timeUntilMs,
    isToday,
    isLive,
  }
}
