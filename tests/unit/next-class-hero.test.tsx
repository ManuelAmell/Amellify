import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextClassHero } from '@/components/schedule/next-class-hero'
import { makeCourse, makeSchedule } from './helpers/fixtures'

// The component computes the countdown from the wall clock in
// America/Bogota (UTC-5, no DST). Freezing a fake clock at
// 2026-03-04T12:00:00Z ≙ Wednesday 07:00:00 Bogotá makes every countdown
// string below deterministic.
const FIXED_NOW = new Date('2026-03-04T12:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NextClassHero', () => {
  it('renders the empty state when there is nothing upcoming', () => {
    render(<NextClassHero courses={[]} />)

    expect(screen.getByText('Sin clases pendientes')).toBeTruthy()
    expect(screen.getByText(/No tienes más clases programadas/)).toBeTruthy()
  })

  it('treats paused courses as no upcoming class', () => {
    render(
      <NextClassHero
        courses={[
          makeCourse({ status: 'paused', schedules: [makeSchedule({ day: 'Jueves', startTime: '10:00', endTime: '12:00' })] }),
        ]}
      />
    )

    expect(screen.getByText('Sin clases pendientes')).toBeTruthy()
  })

  it('shows a days-long countdown for a class later in the week', () => {
    // Today is Wednesday 07:00 Bogotá; next Monday 08:00-09:00 is 5 days + 1h away.
    render(
      <NextClassHero
        courses={[
          makeCourse({ schedules: [makeSchedule({ day: 'Lunes', startTime: '08:00', endTime: '09:00' })] }),
        ]}
      />
    )

    expect(screen.getByText('Próxima Clase')).toBeTruthy()
    expect(screen.getByText('[CALC1]')).toBeTruthy()
    expect(screen.getByText('Cálculo I')).toBeTruthy()
    expect(screen.getByText(/Lunes 08:00 - 09:00/)).toBeTruthy()
    expect(screen.getByText('Comienza en')).toBeTruthy()
    expect(screen.getByText('En 5d 1h 0m')).toBeTruthy()
  })

  it('shows a same-day countdown with hours, minutes and seconds', () => {
    // Today's 10:00-12:00 class starts 3h from the frozen clock (07:00).
    render(
      <NextClassHero
        courses={[
          makeCourse({ schedules: [makeSchedule({ day: 'Miércoles', startTime: '10:00', endTime: '12:00' })] }),
        ]}
      />
    )

    expect(screen.getByText(/Miércoles 10:00 - 12:00/)).toBeTruthy()
    expect(screen.getByText('En 3h 0m 0s')).toBeTruthy()
  })

  it('marks the current class as live when the frozen clock falls inside it', () => {
    // 06:00-08:00 class while it is 07:00 Bogotá.
    render(
      <NextClassHero
        courses={[
          makeCourse({ schedules: [makeSchedule({ day: 'Miércoles', startTime: '06:00', endTime: '08:00' })] }),
        ]}
      />
    )

    expect(screen.getByText('Clase en Vivo')).toBeTruthy()
    expect(screen.getByText('¡En curso ahora!')).toBeTruthy()
    expect(screen.getByText('Estado')).toBeTruthy()
    expect(screen.queryByText('Comienza en')).toBeNull()
  })

  it('ticks the countdown per second, not per minute (H3 regression guard)', () => {
    render(
      <NextClassHero
        courses={[
          makeCourse({ schedules: [makeSchedule({ day: 'Miércoles', startTime: '10:00', endTime: '12:00' })] }),
        ]}
      />
    )
    expect(screen.getByText('En 3h 0m 0s')).toBeTruthy()

    // The old minute-granular implementation kept showing 'En 3h 0m 0s' for
    // a whole minute after the first render; per-second precision must move
    // the string away within a single tick. (The live-state flip itself is
    // covered by the frozen-clock live test above.)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('En 2h 59m 59s')).toBeTruthy()
  })

  it('picks the earliest class when several are scheduled', () => {
    render(
      <NextClassHero
        courses={[
          makeCourse({
            code: 'ESTAT',
            name: 'Estadística',
            schedules: [makeSchedule({ id: 'sched-2', day: 'Miércoles', startTime: '14:00', endTime: '16:00' })],
          }),
          makeCourse({
            id: 'course-2',
            code: 'FIS2',
            name: 'Física II',
            schedules: [makeSchedule({ id: 'sched-3', day: 'Miércoles', startTime: '09:00', endTime: '10:30' })],
          }),
        ]}
      />
    )

    // 09:00 is 2h away (frozen clock 07:00) — earlier than Estadística's 14:00.
    expect(screen.getByText('Física II')).toBeTruthy()
    expect(screen.getByText('[FIS2]')).toBeTruthy()
    expect(screen.getByText('En 2h 0m 0s')).toBeTruthy()
    expect(screen.queryByText('Estadística')).toBeNull()
  })
})
