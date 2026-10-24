import type { CourseWithDetails, Schedule, PartialGrade } from '@/types/database'

/**
 * Shared fixtures for component tests (schedule / courses / stats).
 * Follows the factory style of `tests/unit/calculator-view.test.tsx`.
 */

export const NOW = new Date().toISOString()

export function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    courseId: 'course-1',
    day: 'Lunes',
    startTime: '08:00',
    endTime: '10:00',
    room: 'A-101',
    createdAt: NOW,
    ...overrides,
  }
}

export function makePartial(overrides: Partial<PartialGrade> = {}): PartialGrade {
  return {
    id: 'partial-1',
    courseId: 'course-1',
    name: 'Corte 1',
    grade: null,
    percent: 50,
    sortOrder: 0,
    createdAt: NOW,
    ...overrides,
  }
}

export function makeCourse(overrides: Partial<CourseWithDetails> = {}): CourseWithDetails {
  return {
    id: 'course-1',
    userId: 'user-1',
    code: 'CALC1',
    name: 'Cálculo I',
    professor: 'Gabriel Chanchi',
    email: '',
    faculty: 'Ingeniería',
    semester: '2026-1',
    credits: 3,
    status: 'active',
    notes: '',
    color: 'blue',
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    schedules: [makeSchedule()],
    partials: [],
    ...overrides,
  }
}
