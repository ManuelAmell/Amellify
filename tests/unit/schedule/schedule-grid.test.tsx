import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScheduleGrid } from '@/components/schedule/schedule-grid'
import type { CourseWithDetails, Schedule } from '@/types/database'

// Mock CourseDialog since it might have side effects
vi.mock('@/components/courses/course-dialog', () => ({
  CourseDialog: () => null,
}))

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

describe('ScheduleGrid', () => {
  it('muestra grid de horario con días laborales por defecto', () => {
    const { container } = render(<ScheduleGrid courses={[makeCourse()]} timeFormat24h={true} />)
    expect(container.textContent).toMatch(/Horario Semanal/)
    expect(container.textContent).toMatch(/Lunes/)
    expect(container.textContent).toMatch(/Viernes/)
  })

  it('muestra estado con materias activas cuando hay horarios', () => {
    const course = makeCourse({
      schedules: [
        { id: 's1', courseId: 'course-1', day: 'Martes', start_time: '09:00', end_time: '11:00', room: 'B202' } as Schedule,
      ],
    })
    const { container } = render(<ScheduleGrid courses={[course]} timeFormat24h={true} />)
    expect(container.textContent).toMatch(/materias activas/)
  })
})
