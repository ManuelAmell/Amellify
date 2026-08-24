import type { CourseWithDetails, DayOfWeek } from '@/types/database'
import { SPANISH_DAY_TO_INDEX } from '@/lib/utils/time'

/**
 * Generates an iCalendar (.ics) formatted string for recurring weekly schedules
 */
export function generateICS(courses: CourseWithDetails[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amellify//Academic Schedule Manager//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Horario Universitario - Amellify',
    'X-WR-TIMEZONE:America/Bogota',
  ]

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0')
  const currentDay = now.getDate().toString().padStart(2, '0')
  const dtstamp = `${currentYear}${currentMonth}${currentDay}T000000Z`

  const dayToIcsRrule: Record<DayOfWeek, string> = {
    Lunes: 'MO',
    Martes: 'TU',
    Miércoles: 'WE',
    Jueves: 'TH',
    Viernes: 'FR',
    Sábado: 'SA',
    Domingo: 'SU',
  }

  for (const course of courses) {
    if (course.status !== 'active') continue

    for (const schedule of course.schedules) {
      const targetDayIndex = SPANISH_DAY_TO_INDEX[schedule.day] // 0=Dom, 1=Lun ...
      const currentDayIndex = now.getDay() // 0=Dom, 1=Lun ...

      // Find next date corresponding to this day of the week
      let diff = targetDayIndex - currentDayIndex
      if (diff < 0) diff += 7

      const eventDate = new Date(now)
      eventDate.setDate(now.getDate() + diff)

      const y = eventDate.getFullYear()
      const m = (eventDate.getMonth() + 1).toString().padStart(2, '0')
      const d = eventDate.getDate().toString().padStart(2, '0')

      const startTimeFormatted = schedule.start_time.replace(':', '').substring(0, 4) + '00'
      const endTimeFormatted = schedule.end_time.replace(':', '').substring(0, 4) + '00'

      const dtstart = `${y}${m}${d}T${startTimeFormatted}`
      const dtend = `${y}${m}${d}T${endTimeFormatted}`
      const rruleDay = dayToIcsRrule[schedule.day] || 'MO'

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${course.id}-${schedule.id || Math.random().toString(36).substring(7)}@amellify.app`)
      lines.push(`DTSTAMP:${dtstamp}`)
      lines.push(`DTSTART:${dtstart}`)
      lines.push(`DTEND:${dtend}`)
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay}`)
      lines.push(`SUMMARY:${escapeICS(course.code)} - ${escapeICS(course.name)}`)
      if (schedule.room) {
        lines.push(`LOCATION:${escapeICS(schedule.room)}`)
      }
      lines.push(
        `DESCRIPTION:${escapeICS(
          `Profesor: ${course.professor || 'No asignado'}\\nCréditos: ${course.credits}\\nFacultad: ${course.faculty || 'N/A'}`
        )}`
      )
      lines.push('STATUS:CONFIRMED')
      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function escapeICS(str: string): string {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}
