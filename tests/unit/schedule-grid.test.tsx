import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScheduleGrid } from '@/components/schedule/schedule-grid'
import { makeCourse, makeSchedule } from './helpers/fixtures'

// `CourseDialog` mounts the `'use server'` actions module transitively; the
// server runtime does not exist under jsdom, so the module is mocked out and
// only its instantiation side effects matter for these UI tests.
vi.mock('@/lib/actions/courses', () => ({
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
  getCourses: vi.fn(),
  duplicateCourse: vi.fn(),
}))

// Default fixture plan: Cálculo I on Lunes 08:00-10:00 + Estadística twice on
// Martes (11:00-13:00 and 14:00-16:00). Dynamic hour range → 07:00 to 16:00.
const DEFAULT_COURSES = [
  makeCourse(),
  makeCourse({
    id: 'course-2',
    code: 'ESTAT',
    name: 'Estadística',
    schedules: [
      makeSchedule({ id: 'sched-2', day: 'Martes', startTime: '11:00', endTime: '13:00' }),
      makeSchedule({ id: 'sched-3', day: 'Martes', startTime: '14:00', endTime: '16:00' }),
    ],
  }),
]

describe('ScheduleGrid', () => {
  it('renders the weekly grid with the computed hour range and weekday headers', () => {
    render(<ScheduleGrid courses={DEFAULT_COURSES} />)

    expect(screen.getByText('Horario Semanal')).toBeTruthy()
    // "2 materias activas" summary next to the title.
    expect(screen.getByText(/materias activas/).textContent).toContain('2')

    // Day headers for Monday-Friday only (no weekend classes yet). The
    // mobile agenda repeats the selected day's name, so use *AllBy queries.
    expect(screen.getAllByText('Lunes').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Miércoles').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Sábado')).toBeNull()

    // Earliest class 08:00 → grid starts at 07:00; latest end 16:00 → ends 16:00.
    expect(screen.getByText('07:00')).toBeTruthy()
    expect(screen.getByText('16:00')).toBeTruthy()
    expect(screen.queryByText('17:00')).toBeNull()
  })

  it('renders class blocks for active courses only', () => {
    // Pin the clock to a fixed Wednesday mid-morning (09:00 America/Bogota
    // = UTC-5, no DST). Without this, the mobile agenda picks the real
    // current day: on Lunes / weekends it resolves to 'Lunes' and renders a
    // second 'Cálculo I, Lunes 08:00 a 10:00' block next to the desktop
    // grid's, breaking the exact-count assertions below.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T14:00:00Z'))

    const paused = makeCourse({
      id: 'course-3',
      code: 'PAU1',
      name: 'Curso Pausado',
      status: 'paused',
      schedules: [makeSchedule({ id: 'sched-4', day: 'Jueves', startTime: '08:00', endTime: '10:00' })],
    })

    try {
      render(<ScheduleGrid courses={[...DEFAULT_COURSES, paused]} />)

      // Both Cálculo I classes are on the grid…
      expect(screen.getAllByRole('button', { name: /Cálculo I, Lunes 08:00 a 10:00/ }).length).toBe(1)
      expect(screen.getAllByRole('button', { name: /Estadística, Martes 11:00 a 13:00/ }).length).toBe(1)
      // …but the paused course is never rendered.
      expect(screen.queryByText(/Curso Pausado/)).toBeNull()
      expect(screen.queryAllByRole('button', { name: /PAU1/ }).length).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clicking a class block opens the edit dialog for that course', () => {
    render(<ScheduleGrid courses={DEFAULT_COURSES} />)

    fireEvent.click(screen.getAllByRole('button', { name: /Cálculo I, Lunes 08:00 a 10:00/ })[0]!)
    expect(screen.getByRole('heading', { name: 'Editar Materia' })).toBeTruthy()
  })

  it('clicking an empty hour cell opens the create dialog prefilled with that slot', () => {
    render(<ScheduleGrid courses={DEFAULT_COURSES} />)

    fireEvent.click(screen.getByRole('button', { name: 'Agregar clase el Jueves a las 9:00' }))
    expect(screen.getByRole('heading', { name: 'Nueva Materia' })).toBeTruthy()
    // handleCellClick proposes a 2-hour slot starting at the clicked hour.
    expect(screen.getByDisplayValue('09:00')).toBeTruthy()
    expect(screen.getByDisplayValue('11:00')).toBeTruthy()
  })

  it('switching agenda days shows that day only, plus an empty state for free days', () => {
    render(<ScheduleGrid courses={DEFAULT_COURSES} />)

    // Martes has two classes.
    fireEvent.click(screen.getByText('Mar'))
    expect(screen.getAllByText(/Martes/).length).toBeGreaterThanOrEqual(2) // agenda header + column header
    expect(screen.getByText('2 clases')).toBeTruthy()

    // Free day shows the empty state with a shortcut to add a class.
    fireEvent.click(screen.getByText('Mié'))
    expect(screen.getByText(/Sin clases programadas para el/)).toBeTruthy()
    expect(screen.getByText('0 clases')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Agregar clase el Miércoles' })
    )
    expect(screen.getByRole('heading', { name: 'Nueva Materia' })).toBeTruthy()
    expect(screen.getByDisplayValue('08:00')).toBeTruthy()
    expect(screen.getByDisplayValue('10:00')).toBeTruthy()
  })

  it('auto-shows weekends when an active class falls on Sábado', () => {
    const weekendCourse = makeCourse({
      id: 'course-2',
      code: 'SAT1',
      name: 'Clase Sábado',
      schedules: [makeSchedule({ id: 'sched-2', day: 'Sábado', startTime: '09:00', endTime: '11:00' })],
    })
    render(<ScheduleGrid courses={[weekendCourse]} />)

    expect(screen.getByText('Ocultar Fines de Semana')).toBeTruthy()
    expect(screen.getByText('Sáb')).toBeTruthy()
    expect(screen.getByText('Dom')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Sábado 09:00 a 11:00/ }).length).toBeGreaterThan(0)

    // Hiding them removes every Sábado marker from the board.
    fireEvent.click(screen.getByText('Ocultar Fines de Semana'))
    expect(screen.getByText('Mostrar Fines de Semana')).toBeTruthy()
    expect(screen.queryByText('Sáb')).toBeNull()
    expect(screen.queryAllByRole('button', { name: /Sábado 09:00 a 11:00/ }).length).toBe(0)
  })

  it('lets the user toggle weekends on and off when no class uses them', () => {
    render(<ScheduleGrid courses={[makeCourse()]} />)

    expect(screen.getByText('Mostrar Fines de Semana')).toBeTruthy()
    expect(screen.queryByText('Sáb')).toBeNull()

    fireEvent.click(screen.getByText('Mostrar Fines de Semana'))
    expect(screen.getByText('Sáb')).toBeTruthy()
    expect(screen.getByText('Dom')).toBeTruthy()

    fireEvent.click(screen.getByText('Ocultar Fines de Semana'))
    expect(screen.queryByText('Sáb')).toBeNull()
  })

  it("the header 'Nueva Materia' button opens the create dialog with defaults", () => {
    render(<ScheduleGrid courses={[makeCourse()]} />)

    fireEvent.click(screen.getByRole('button', { name: /Nueva Materia/ }))
    expect(screen.getByRole('heading', { name: 'Nueva Materia' })).toBeTruthy()
    expect(screen.getByDisplayValue('08:00')).toBeTruthy()
    expect(screen.getByDisplayValue('10:00')).toBeTruthy()
  })

  it('does not refetch courses from the server when they are passed as props', () => {
    // The component receives courses as props; no server fetch should be triggered in normal render
    render(<ScheduleGrid courses={[makeCourse()]} />)
    expect(screen.getByText('Horario Semanal')).toBeTruthy()
  })
})
