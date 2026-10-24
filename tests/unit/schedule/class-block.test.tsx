import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClassBlock } from '@/components/schedule/class-block'
import type { CourseWithDetails, Schedule } from '@/types/database'

const now = new Date().toISOString()

function makeCourse(overrides: Partial<CourseWithDetails> = {}): CourseWithDetails {
  return {
    id: 'course-1',
    userId: 'user-1',
    code: 'PROG1',
    name: 'Programación I',
    professor: 'Ana López',
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

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 's1',
    courseId: 'course-1',
    day: 'Lunes',
    start_time: '08:00',
    end_time: '10:00',
    room: 'A101',
    ...overrides,
  } as Schedule
}

describe('ClassBlock', () => {
  it('renderiza código, nombre y salón al hacer click', () => {
    const course = makeCourse()
    const schedule = makeSchedule()
    const onClick = vi.fn()
    const { container, getByRole } = render(
      <ClassBlock
        course={course}
        schedule={schedule}
        topPx={10}
        heightPx={116}
        lane={0}
        laneCount={1}
        onClick={onClick}
      />
    )
    expect(container.textContent).toMatch(/PROG1/)
    expect(container.textContent).toMatch(/Programación I/)
    expect(container.textContent).toMatch(/A101/)
    fireEvent.click(getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})
