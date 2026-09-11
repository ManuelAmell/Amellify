import { describe, expect, it } from 'vitest'
import type { CourseWithDetails, Schedule } from '@/types/domain'
import {
  DEFAULT_TIMEZONE,
  formatDisplayTime,
  getNextClass,
  getZonedParts,
  minutesToTime,
  timeToMinutes,
} from '@/lib/utils/time'

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    courseId: 'course-1',
    day: 'Lunes',
    startTime: '08:00',
    endTime: '10:00',
    room: 'A-101',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeCourse(overrides: Partial<CourseWithDetails> = {}): CourseWithDetails {
  return {
    id: 'course-1',
    userId: 'user-1',
    code: 'CS101',
    name: 'Algoritmos',
    professor: 'Prof. X',
    email: '',
    faculty: '',
    semester: '',
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

describe('timeToMinutes', () => {
  it('converts a normal HH:MM string', () => {
    expect(timeToMinutes('08:40')).toBe(520)
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('accepts HH:MM:SS by ignoring seconds', () => {
    expect(timeToMinutes('10:15:30')).toBe(615)
  })

  it('clamps out-of-range hours/minutes instead of silently overflowing', () => {
    // Old bug: "25:99" => 25*60+99 = 1599 (contaminates sorts/comparisons).
    expect(timeToMinutes('25:99')).toBe(23 * 60 + 59)
  })

  it('returns 0 for empty/garbage input', () => {
    expect(timeToMinutes('')).toBe(0)
  })
})

describe('minutesToTime', () => {
  it('round-trips with timeToMinutes', () => {
    expect(minutesToTime(520)).toBe('08:40')
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('clamps out-of-range minutes', () => {
    expect(minutesToTime(-10)).toBe('00:00')
    expect(minutesToTime(10_000)).toBe('23:59')
  })
})

describe('formatDisplayTime', () => {
  it('passes through 24h format', () => {
    expect(formatDisplayTime('14:30', true)).toBe('14:30')
  })

  it('converts to 12h format', () => {
    expect(formatDisplayTime('14:30', false)).toBe('2:30 PM')
    expect(formatDisplayTime('00:15', false)).toBe('12:15 AM')
    expect(formatDisplayTime('12:00', false)).toBe('12:00 PM')
  })
})

describe('getZonedParts', () => {
  it('reads wall-clock parts for a known instant in America/Bogota (UTC-5, no DST)', () => {
    // 2026-03-09 is a Monday. 12:00:05 UTC == 07:00:05 in Bogota.
    const parts = getZonedParts(new Date('2026-03-09T12:00:05.000Z'), 'America/Bogota')
    expect(parts.dayIndex).toBe(1) // Monday
    expect(parts.secondsOfDay).toBe(7 * 3600 + 5)
  })
})

describe('getNextClass', () => {
  it('returns null when there are no active courses', () => {
    expect(getNextClass([])).toBeNull()
    expect(getNextClass([makeCourse({ status: 'paused' })])).toBeNull()
  })

  it('computes a real second-level countdown (fixes the "always 0s" bug)', () => {
    // Monday 07:59:45 Bogota time; class starts 08:00 -> should be 15s away, not 0 or 60000ms.
    const now = new Date('2026-03-09T12:59:45.000Z') // 07:59:45 America/Bogota
    const course = makeCourse({ schedules: [makeSchedule({ day: 'Lunes', startTime: '08:00', endTime: '10:00' })] })

    const result = getNextClass([course], { now, timezone: 'America/Bogota' })

    expect(result).not.toBeNull()
    expect(result?.timeUntilMs).toBe(15_000)
    expect(result?.isToday).toBe(true)
    expect(result?.isLive).toBe(false)
  })

  it('marks a class as live when now falls within its range', () => {
    const now = new Date('2026-03-09T14:00:00.000Z') // 09:00 Bogota, inside 08:00-10:00
    const course = makeCourse()

    const result = getNextClass([course], { now, timezone: 'America/Bogota' })
    expect(result?.isLive).toBe(true)
  })

  it('rolls over to next week when today\'s class already ended', () => {
    const now = new Date('2026-03-09T15:30:00.000Z') // 10:30 Bogota, after the 08:00-10:00 class
    const course = makeCourse()

    const result = getNextClass([course], { now, timezone: 'America/Bogota' })
    expect(result?.isToday).toBe(false)
    // ~6 days, 21.5 hours away.
    expect(result?.timeUntilMs).toBeGreaterThan(6 * 24 * 3600 * 1000)
  })

  it('picks the earliest of multiple upcoming classes', () => {
    const now = new Date('2026-03-09T12:00:00.000Z') // Monday 07:00 Bogota
    const course = makeCourse({
      schedules: [
        makeSchedule({ id: 'late', day: 'Lunes', startTime: '14:00', endTime: '16:00' }),
        makeSchedule({ id: 'early', day: 'Lunes', startTime: '08:00', endTime: '09:00' }),
      ],
    })

    const result = getNextClass([course], { now, timezone: 'America/Bogota' })
    expect(result?.schedule.id).toBe('early')
  })

  it('defaults to America/Bogota when no timezone is given', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Bogota')
  })
})
