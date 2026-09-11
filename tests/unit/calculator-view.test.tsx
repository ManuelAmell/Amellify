import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalculatorView } from '@/components/calculator/calculator-view'
import type { CourseWithDetails } from '@/types/database'

// `savePartials` is a `'use server'` action — invoking the real module in
// jsdom has no Next.js server runtime behind it, so it's mocked out. This
// test never calls it; it only mounts the component.
vi.mock('@/lib/actions/partials', () => ({
  savePartials: vi.fn(),
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
    partials: [
      { id: 'p1', courseId: 'course-1', name: 'Corte 1', grade: 4, percent: 30, sortOrder: 0, createdAt: now },
      { id: 'p2', courseId: 'course-1', name: 'Corte 2', grade: null, percent: 70, sortOrder: 1, createdAt: now },
    ],
    ...overrides,
  }
}

describe('CalculatorView', () => {
  // Regression test for a real infinite-render bug: the "sync from server
  // when not dirty" branch of the course-switch effect (calculator-view.tsx)
  // used to list its own output (`partials`) as a dependency while writing
  // a brand-new array reference to it on every run, so it re-triggered
  // itself forever from the very first render (isDirty defaults to false).
  // If that regresses, `render()` below either throws React's nested-update
  // guard or the test times out — either way this test fails instead of
  // silently passing.
  it('mounts without entering a render loop and shows the computed average', async () => {
    render(<CalculatorView courses={[makeCourse()]} passingGrade={3} maxGrade={5} />)

    expect(await screen.findByText('Cálculo I')).toBeTruthy()
    // 4 * 30% over a 30% completed portion = average 4.00.
    expect(screen.getByText('4.00')).toBeTruthy()
  })

  it('re-rendering with a new (but equal) courses array does not wipe an in-progress edit', async () => {
    const course = makeCourse()
    const { rerender } = render(
      <CalculatorView courses={[course]} passingGrade={3} maxGrade={5} />
    )
    await screen.findByText('Cálculo I')

    // Simulate typing into the second (ungraded) partial's grade field.
    const GRADE_PLACEHOLDER = 'Nota (vacío = simular)'
    const gradeInputs = screen.getAllByPlaceholderText(GRADE_PLACEHOLDER) as HTMLInputElement[]
    const secondGradeInput = gradeInputs[1]!
    fireEvent.change(secondGradeInput, { target: { value: '4.5' } })

    // Parent re-fetches and passes a structurally-identical-but-new course
    // object, as a real Next.js server-action refresh would.
    rerender(<CalculatorView courses={[makeCourse()]} passingGrade={3} maxGrade={5} />)

    const stillEditing = screen.getAllByPlaceholderText(GRADE_PLACEHOLDER)[1] as HTMLInputElement
    expect(stillEditing.value).toBe('4.5')
  })
})
