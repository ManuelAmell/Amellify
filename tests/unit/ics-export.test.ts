import { describe, expect, it } from 'vitest'
import type { CourseWithDetails, Schedule } from '@/types/domain'
import { generateICS } from '@/lib/ics-export'

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-abc',
    courseId: 'course-1',
    day: 'Lunes',
    startTime: '08:00',
    endTime: '10:00',
    room: 'A-304',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeCourse(overrides: Partial<CourseWithDetails> = {}): CourseWithDetails {
  return {
    id: 'course-1',
    userId: 'user-1',
    code: 'CS101',
    name: 'Cálculo',
    professor: 'Prof. X',
    email: '',
    faculty: 'Ingeniería',
    semester: '2026-1',
    credits: 3,
    status: 'active',
    notes: '',
    color: 'blue',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    schedules: [makeSchedule()],
    partials: [],
    ...overrides,
  }
}

const NOW = new Date('2026-03-09T12:00:00.000Z') // Monday, 07:00 America/Bogota

/** Unfolds RFC 5545 line folding (CRLF + single space) back into logical lines. */
function unfold(ics: string): string[] {
  return ics.split('\r\n').reduce<string[]>((lines, raw) => {
    if (raw.startsWith(' ') && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1)
    } else {
      lines.push(raw)
    }
    return lines
  }, [])
}

describe('generateICS', () => {
  it('produces a valid-looking single event with TZID and a bounded RRULE', () => {
    const ics = generateICS([makeCourse()], { now: NOW, timezone: 'America/Bogota' })
    const lines = unfold(ics)

    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VTIMEZONE')
    expect(ics).toContain('TZID:America/Bogota')

    // `l.startsWith('DTSTART')` alone would also match VTIMEZONE's bare
    // "DTSTART:19700101T000000" line — scope to the VEVENT property, which
    // always carries a `;TZID=` parameter.
    const dtstart = lines.find((l) => l.startsWith('DTSTART;'))
    const dtend = lines.find((l) => l.startsWith('DTEND;'))
    expect(dtstart).toMatch(/^DTSTART;TZID=America\/Bogota:\d{8}T080000$/)
    expect(dtend).toMatch(/^DTEND;TZID=America\/Bogota:\d{8}T100000$/)

    const rrule = lines.find((l) => l.startsWith('RRULE'))
    expect(rrule).toMatch(/^RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=\d{8}T\d{6}Z$/)

    const uid = lines.find((l) => l.startsWith('UID'))
    expect(uid).toBe('UID:sched-abc@amellify')
  })

  it('skips non-active courses', () => {
    const ics = generateICS([makeCourse({ status: 'paused' })], { now: NOW })
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('honors a configured semesterEndDate for RRULE UNTIL', () => {
    const ics = generateICS([makeCourse()], {
      now: NOW,
      timezone: 'America/Bogota',
      semesterEndDate: '2026-06-15',
    })
    const rrule = unfold(ics).find((l) => l.startsWith('RRULE'))
    // 2026-06-15 23:59:59 America/Bogota (UTC-5) == 2026-06-16 04:59:59Z
    expect(rrule).toContain('UNTIL=20260616T045959Z')
  })

  it('defaults UNTIL to +18 weeks from now when no semesterEndDate is set', () => {
    const ics = generateICS([makeCourse()], { now: NOW, timezone: 'America/Bogota' })
    const rrule = unfold(ics).find((l) => l.startsWith('RRULE'))
    const match = /UNTIL=(\d{8})T/.exec(rrule ?? '')
    expect(match).not.toBeNull()
    // now (2026-03-09, America/Bogota) + 126 days (18 weeks) = local 2026-07-13
    // 23:59:59 -05:00; converted to UTC (required by RFC 5545 for UNTIL) that
    // rolls over to 2026-07-14T04:59:59Z.
    expect(match?.[1]).toBe('20260714')
  })

  it('generates a deterministic UID per schedule block (no Math.random)', () => {
    const ics1 = generateICS([makeCourse()], { now: NOW })
    const ics2 = generateICS([makeCourse()], { now: NOW })
    const uid1 = unfold(ics1).find((l) => l.startsWith('UID'))
    const uid2 = unfold(ics2).find((l) => l.startsWith('UID'))
    expect(uid1).toBe(uid2)
    expect(uid1).toBe('UID:sched-abc@amellify')
  })

  it('folds long SUMMARY/DESCRIPTION lines to 75 octets per physical line', () => {
    const longName = 'Introducción a la Ingeniería de Sistemas Distribuidos y Arquitecturas Avanzadas'
    const longProfessor = 'Profesor Doctor Fulano de Tal con un Nombre Excepcionalmente Largo y Detallado'
    const course = makeCourse({ name: longName, professor: longProfessor })

    const ics = generateICS([course], { now: NOW })
    const rawLines = ics.split('\r\n')

    // Every RAW physical line (pre-unfold) must be <= 75 octets.
    for (const line of rawLines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }

    // At least one property actually got folded (continuation line present).
    expect(rawLines.some((l) => l.startsWith(' '))).toBe(true)

    // Unfolded, the content survives intact.
    const unfolded = unfold(ics)
    const summary = unfolded.find((l) => l.startsWith('SUMMARY'))
    expect(summary).toContain(longName)
  })

  it('escapes commas/semicolons and uses a real single-backslash \\n for line breaks', () => {
    const course = makeCourse({ professor: 'Smith, John; Jr.', faculty: 'Ciencias & Artes' })
    const ics = generateICS([course], { now: NOW })
    const description = unfold(ics).find((l) => l.startsWith('DESCRIPTION'))

    expect(description).toBeDefined()
    expect(description).toContain('Smith\\, John\\; Jr.')
    // Correctly escaped newline: a literal backslash followed by "n", not a doubled backslash.
    expect(description).toMatch(/Profesor:.*\\nCréditos:.*\\nFacultad:/)
    expect(description).not.toContain('\\\\n')
  })
})
