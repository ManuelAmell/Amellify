import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CoursesView } from '@/components/courses/courses-view'
import type { CourseWithDetails, Schedule } from '@/types/database'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

// Mock server actions and ics export to avoid side effects
vi.mock('@/lib/actions/courses', () => ({
  duplicateCourse: vi.fn(),
  deleteCourse: vi.fn(),
}))

vi.mock('@/lib/ics-export', () => ({
  generateICS: vi.fn(() => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR'),
}))

const now = new Date().toISOString()

function makeCourse(overrides: Partial<CourseWithDetails> = {}): CourseWithDetails {
  return {
    id: 'course-1',
    userId: 'user-1',
    code: 'CALC1',
    name: 'Cálculo I',
    professor: 'Prof. X',
    email: '',
    faculty: '',
    semester: '2026-1',
    credits: 3,
    status: 'active',
    notes: '',
    color: 'blue',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    schedules: [
      { id: 's1', courseId: 'course-1', day: 'Lunes', start_time: '08:00', end_time: '10:00', room: 'A101' } as Schedule,
    ],
    partials: [],
    ...overrides,
  }
}

describe('CoursesView', () => {
  it('muestra lista vacía con mensaje cuando no hay materias', () => {
    const { container } = render(<CoursesView initialCourses={[]} timeFormat24h={true} />)
    expect(container.textContent).toMatch(/Lista de Materias/)
    expect(container.textContent).toMatch(/No se encontraron materias/)
  })

  it('renderiza tarjeta de materia con código, nombre, profesor y horarios', () => {
    const { container } = render(<CoursesView initialCourses={[makeCourse()]} timeFormat24h={true} />)
    expect(container.textContent).toMatch(/CALC1/)
    expect(container.textContent).toMatch(/Cálculo I/)
    expect(container.textContent).toMatch(/Prof\. X/)
    expect(container.textContent).toMatch(/Lunes/)
    expect(container.textContent).toMatch(/A101/)
  })
})
