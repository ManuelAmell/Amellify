import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NextClassHero } from '@/components/schedule/next-class-hero'
import type { CourseWithDetails } from '@/types/database'

const now = new Date().toISOString()

function makeCourse(overrides: Partial<CourseWithDetails> = {}): CourseWithDetails {
  return {
    id: 'course-1',
    userId: 'user-1',
    code: 'CALC1',
    name: 'Cálculo I',
    professor: 'Prof. Test',
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

describe('NextClassHero', () => {
  it('muestra estado vacío cuando no hay clases pendientes', () => {
    const { container } = render(<NextClassHero courses={[]} />)
    expect(container.textContent).toMatch(/Sin clases pendientes/)
  })

  it('muestra estado vacío cuando hay materias sin horarios', () => {
    const { container } = render(<NextClassHero courses={[makeCourse({ schedules: [] })]} />)
    expect(container.textContent).toMatch(/Sin clases pendientes/)
  })
})
