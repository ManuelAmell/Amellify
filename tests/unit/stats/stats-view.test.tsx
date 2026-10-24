import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatsView } from '@/components/stats/stats-view'
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

describe('StatsView', () => {
  it('muestra estado sin datos cuando no hay notas ni horarios', () => {
    const { container } = render(<StatsView courses={[makeCourse()]} passingGrade={3} maxGrade={5} />)
    expect(container.textContent).toMatch(/Estadísticas/)
  })

  it('muestra carga horaria con domingo incluido y mejor materia', () => {
    const courses = [
      makeCourse({
        id: 'c1',
        code: 'MAT1',
        name: 'Matemáticas',
        credits: 3,
        schedules: [
          { id: 's1', courseId: 'c1', day: 'Lunes', start_time: '08:00', end_time: '10:00' } as Schedule,
          { id: 's2', courseId: 'c1', day: 'Domingo', start_time: '09:00', end_time: '11:00' } as Schedule,
        ],
        partials: [
          { id: 'p1', courseId: 'c1', name: 'Parcial 1', grade: 4, percent: 50, sortOrder: 0, createdAt: now } as PartialGrade,
          { id: 'p2', courseId: 'c1', name: 'Parcial 2', grade: 4, percent: 50, sortOrder: 1, createdAt: now } as PartialGrade,
        ],
      }),
    ]
    const { container } = render(<StatsView courses={courses} passingGrade={3} maxGrade={5} />)
    expect(container.textContent).toMatch(/Carga Horaria/)
    expect(container.textContent).toMatch(/Domingo/)
    expect(container.textContent).toMatch(/Matemáticas/)
  })
})
