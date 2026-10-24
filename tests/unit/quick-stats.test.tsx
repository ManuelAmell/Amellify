import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuickStats } from '@/components/stats/quick-stats'
import { makeCourse, makePartial, makeSchedule } from './helpers/fixtures'

/** Text content of the value cell that follows a given stat label. */
function statValue(label: string): string | undefined {
  return screen.getByText(label).nextElementSibling?.textContent?.trim().replace(/\s+/g, ' ')
}

describe('QuickStats', () => {
  it('renders zeroed stats for an empty course list', () => {
    render(<QuickStats courses={[]} />)

    expect(statValue('Materias Activas')).toBe('0')
    expect(statValue('Créditos Inscritos')).toBe('0 pts')
    expect(statValue('Horas Semanales')).toBe('0 hrs')
    expect(screen.getByText('Sin notas')).toBeTruthy()
  })

  it('counts only active courses, their credits and weekly class hours', () => {
    const active = makeCourse({
      credits: 4,
      schedules: [
        makeSchedule({ id: 's1', day: 'Lunes', startTime: '08:00', endTime: '10:00' }),
        makeSchedule({ id: 's2', day: 'Miércoles', startTime: '10:00', endTime: '11:30' }),
      ],
    })
    const paused = makeCourse({
      id: 'course-2',
      code: 'FIS1',
      name: 'Física I',
      status: 'paused',
      credits: 99,
      schedules: [makeSchedule({ id: 's3', startTime: '08:00', endTime: '18:00' })],
    })

    render(<QuickStats courses={[active, paused]} />)

    expect(statValue('Materias Activas')).toBe('1')
    expect(statValue('Créditos Inscritos')).toBe('4 pts')
    // 2h (Lunes) + 1.5h (Miércoles) = 3.5; the paused course contributes nothing.
    expect(statValue('Horas Semanales')).toBe('3.5 hrs')
    // No graded partials yet.
    expect(screen.getByText('Sin notas')).toBeTruthy()
  })

  it('shows the credit-weighted global average when partials are graded', () => {
    const graded = makeCourse({
      credits: 4,
      partials: [makePartial({ grade: 4.5, percent: 100 })],
    })

    render(<QuickStats courses={[graded]} passingGrade={3} maxGrade={5} />)

    expect(statValue('Promedio General')).toBe('4.50 / 5')
  })

  it('ignores ungraded partials when computing the global average', () => {
    const ungraded = makeCourse({
      partials: [makePartial({ grade: null, percent: 100 })],
    })

    render(<QuickStats courses={[ungraded]} />)

    expect(screen.getByText('Sin notas')).toBeTruthy()
  })
})
