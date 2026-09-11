import type { CourseWithDetails, DayOfWeek } from '@/types/domain'
import { DEFAULT_TIMEZONE, SPANISH_DAY_TO_INDEX, getZonedParts } from '@/lib/utils/time'

/**
 * iCalendar (.ics) export, rewritten to fix plan finding H18:
 * - `DTSTART`/`DTEND` now carry `TZID=<timezone>` (+ a matching `VTIMEZONE`
 *   block) instead of floating local time, so Apple/Outlook/Google stop
 *   interpreting classes in the importer's own timezone.
 * - `RRULE` now has an `UNTIL` bound (from `UserPreferences.semesterEndDate`,
 *   or a +18-week default) instead of repeating forever.
 * - `UID` is deterministic (`${schedule.id}@amellify`) so re-importing the
 *   same calendar doesn't create duplicates (old code used `Math.random()`).
 * - Long `SUMMARY`/`DESCRIPTION` lines are folded to 75 octets per RFC 5545.
 * - `DESCRIPTION` now uses real newline characters before escaping, so the
 *   output is a single, correctly-escaped `\n` per line break — the old
 *   code built the string with a literal two-character `\n` and then
 *   escaped its backslash again, producing a literal `\n` in calendar apps.
 *
 * Known simplification: `VTIMEZONE` is emitted as a single fixed-offset
 * `STANDARD` component computed at export time. This is exact for the
 * default timezone (`America/Bogota`, which has no DST), but is a best
 * effort (not historically-accurate) for DST-observing zones — generating
 * a fully correct VTIMEZONE for an arbitrary IANA zone requires a tzdata
 * library, which is out of scope here (see final summary).
 */

const DAY_TO_ICS_BYDAY: Record<DayOfWeek, string> = {
  Lunes: 'MO',
  Martes: 'TU',
  Miércoles: 'WE',
  Jueves: 'TH',
  Viernes: 'FR',
  Sábado: 'SA',
  Domingo: 'SU',
}

export interface GenerateIcsOptions {
  /** IANA timezone; defaults to `DEFAULT_TIMEZONE`. */
  timezone?: string
  /** ISO date (yyyy-mm-dd) for the RRULE UNTIL bound; defaults to +18 weeks from `now`. */
  semesterEndDate?: string | null
  /** Injectable clock for tests. */
  now?: Date
  /** X-WR-CALNAME value. */
  calendarName?: string
}

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, '0')
}

/** UTC offset (in minutes) of `date` as observed in `timeZone`, e.g. -300 for America/Bogota. */
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const hour = parseInt(map.hour ?? '0', 10) % 24
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  )
  return Math.round((asUtc - date.getTime()) / 60000)
}

function formatOffset(minutes: number): string {
  const sign = minutes <= 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
}

/** Converts a local wall-clock date/time in `timeZone` to the actual UTC instant. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone)
  return new Date(utcGuess.getTime() - offsetMinutes * 60000)
}

function addDays(year: number, month: number, day: number, days: number) {
  const dt = new Date(Date.UTC(year, month - 1, day))
  dt.setUTCDate(dt.getUTCDate() + days)
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() }
}

function formatUtcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

/** Escapes ICS TEXT values per RFC 5545 §3.3.11. Order matters: backslash first. */
function escapeICS(str: string): string {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Folds a content line to 75 octets per RFC 5545 §3.1 (UTF-8 safe). */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const decoder = new TextDecoder()
  const segments: string[] = []
  let start = 0
  let budget = 75

  while (start < bytes.length) {
    let end = Math.min(start + budget, bytes.length)
    // Don't split a multi-byte UTF-8 sequence: back off while `end` points
    // at a continuation byte (10xxxxxx).
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--
    segments.push(decoder.decode(bytes.slice(start, end)))
    start = end
    budget = 74 // continuation lines: leading space counts toward the 75-octet budget
  }

  return segments.join('\r\n ')
}

function buildVTimezone(timeZone: string, referenceDate: Date): string[] {
  const offsetMinutes = getTimeZoneOffsetMinutes(referenceDate, timeZone)
  const offset = formatOffset(offsetMinutes)
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${timeZone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    `TZNAME:${offset}`,
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

/**
 * Generates an iCalendar (.ics) formatted string for the weekly recurring
 * schedules of `courses` (active courses only).
 */
export function generateICS(courses: CourseWithDetails[], options: GenerateIcsOptions = {}): string {
  const timeZone = options.timezone || DEFAULT_TIMEZONE
  const now = options.now ?? new Date()
  const calendarName = options.calendarName ?? 'Horario Universitario - Amellify'

  const dtstamp = formatUtcStamp(now)
  const todayParts = getZonedParts(now, timeZone)

  // RRULE UNTIL: end of the semester, in `timeZone`, expressed in UTC.
  let untilY: number, untilM: number, untilD: number
  if (options.semesterEndDate) {
    const [y, m, d] = options.semesterEndDate.split('-').map((n) => parseInt(n, 10))
    untilY = y ?? todayParts.year
    untilM = m ?? todayParts.month
    untilD = d ?? todayParts.day
  } else {
    const defaultEnd = addDays(todayParts.year, todayParts.month, todayParts.day, 18 * 7)
    untilY = defaultEnd.year
    untilM = defaultEnd.month
    untilD = defaultEnd.day
  }
  const untilUtc = zonedTimeToUtc(untilY, untilM, untilD, 23, 59, 59, timeZone)
  const until = formatUtcStamp(untilUtc)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amellify//Academic Schedule Manager//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
    `X-WR-TIMEZONE:${timeZone}`,
    ...buildVTimezone(timeZone, now),
  ]

  for (const course of courses) {
    if (course.status !== 'active') continue

    for (const schedule of course.schedules) {
      const targetDayIndex = SPANISH_DAY_TO_INDEX[schedule.day]
      let dayDiff = targetDayIndex - todayParts.dayIndex
      if (dayDiff < 0) dayDiff += 7

      const eventDate = addDays(todayParts.year, todayParts.month, todayParts.day, dayDiff)

      const [startH, startM] = schedule.startTime.split(':').map((n) => parseInt(n, 10))
      const [endH, endM] = schedule.endTime.split(':').map((n) => parseInt(n, 10))

      const dtstart = `${eventDate.year}${pad(eventDate.month)}${pad(eventDate.day)}T${pad(
        startH ?? 0
      )}${pad(startM ?? 0)}00`
      const dtend = `${eventDate.year}${pad(eventDate.month)}${pad(eventDate.day)}T${pad(
        endH ?? 0
      )}${pad(endM ?? 0)}00`

      const rruleDay = DAY_TO_ICS_BYDAY[schedule.day] ?? 'MO'
      const description = [
        `Profesor: ${course.professor || 'No asignado'}`,
        `Créditos: ${course.credits}`,
        `Facultad: ${course.faculty || 'N/A'}`,
      ].join('\n')

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${schedule.id}@amellify`)
      lines.push(`DTSTAMP:${dtstamp}`)
      lines.push(`DTSTART;TZID=${timeZone}:${dtstart}`)
      lines.push(`DTEND;TZID=${timeZone}:${dtend}`)
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};UNTIL=${until}`)
      lines.push(`SUMMARY:${escapeICS(`${course.code} - ${course.name}`)}`)
      if (schedule.room) {
        lines.push(`LOCATION:${escapeICS(schedule.room)}`)
      }
      lines.push(`DESCRIPTION:${escapeICS(description)}`)
      lines.push('STATUS:CONFIRMED')
      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n')
}
