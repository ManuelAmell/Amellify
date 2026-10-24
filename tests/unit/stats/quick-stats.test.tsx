import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuickStats } from '@/components/stats/quick-stats'
import type { CourseWithDetails, Schedule, PartialGrade } from '@/types/database'

const now = new Date().toISOString()

function makeCourse(overrides: Partial<CourseWithDetails> = {}): CourseWithDetails {
  return {
    id: 'course-1',
    userId: 'user-1',
    code: 'CALC1',
    name: 'Cálculo I',
    professor: '',
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
    schedules: [],
    partials: [],
    ...overrides,
  }
}

describe('QuickStats', () => {
  it('muestra estado vacío / sin notas cuando no hay parciales', () => {
    const { container } = render(<QuickStats courses={[makeCourse({ credits: 3 })]} passingGrade={3} maxGrade={5} />)
    expect(container.textContent).toMatch(/Materias Activas/)
    expect(container.textContent).toMatch(/Sin notas/)
  })

  it('calcula horas semanales y promedio general correctamente', () => {
    const course = makeCourse({
      credits: 4,
      schedules: [
        { id: 's1', courseId: 'course-1', day: 'Lunes', start_time: '08:00', end_time: '10:00' } as Schedule,
        { id: 's2', courseId: 'course-1', day: 'Miércoles', start_time: '14:00', end_time: '16:00' } as Schedule,
      ],
      partials: [
        { id: 'p1', courseId: 'course-1', name: 'Parcial 1', grade: 4, percent: 50, sortOrder: 0, createdAt: now } as PartialGrade,
        { id: 'p2', courseId: 'course-1', name: 'Parcial 2', grade: 5, percent: 50, sortOrder: 1, createdAt: now } as PartialGrade,
      ],
    })
    const { container } = render(<QuickStats courses={[course]} passingGrade={3} maxGrade={5} />)
    expect(container.textContent).toMatch(/4/)
    expect(container.textContent).toMatch(/4\.50/)
  })
})
