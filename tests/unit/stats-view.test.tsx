import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatsView } from '@/components/stats/stats-view'
import { makeCourse, makePartial, makeSchedule } from './helpers/fixtures'

describe('StatsView', () => {
  it('renders the empty state with no active courses', () => {
    render(<StatsView courses={[]} passingGrade={3} maxGrade={5} />)

    expect(screen.getByText('Estadísticas & Rendimiento Académico')).toBeTruthy()
    // Global average cell falls back to an em dash + explanation.
    expect(screen.getByText('Sin notas registradas')).toBeTruthy()
    expect(screen.getByText('No tienes materias activas registradas.')).toBeTruthy()
    expect(screen.getByText('Sin datos')).toBeTruthy()
    expect(screen.getByText('Al día')).toBeTruthy()
  })

  it('excludes non-active courses from credits and performance metrics', () => {
    const active = makeCourse({ credits: 4, status: 'active' })
    const paused = makeCourse({ id: 'course-2', credits: 6, status: 'paused' })

    render(<StatsView courses={[active, paused]} />)

    expect(screen.getByText('En 1 materia activa')).toBeTruthy()
    // Paused course's 6 credits must not be counted.
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('summarizes weekly load and highlights the best course', () => {
    const course = makeCourse({
      name: 'Cálculo I',
      credits: 4,
      schedules: [
        makeSchedule({ id: 's1', day: 'Lunes', startTime: '08:00', endTime: '10:00' }),
        makeSchedule({ id: 's2', day: 'Miércoles', startTime: '08:00', endTime: '09:30' }),
      ],
      partials: [makePartial({ grade: 4.5, percent: 100 })],
    })

    render(<StatsView courses={[course]} passingGrade={3} maxGrade={5} />)

    // 2h + 1.5h = 3.5h across 2 class days → 1.8 hrs/día (3.5/2 rounded to 1 dp).
    expect(screen.getByText('3.5')).toBeTruthy()
    expect(screen.getByText(/1\.8 hrs\/día \(2d de clase\)/)).toBeTruthy()
    // Best course = the only graded one (name repeats in metric + list cards).
    expect(screen.getAllByText('Cálculo I').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Promedio: 4.50')).toBeTruthy()
    // Global card shows the credit-weighted average 4.50 (also in the list row).
    expect(screen.getAllByText('4.50').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('✅ Rendimiento satisfactorio')).toBeTruthy()
    // The lone graded course is still surfaced as lowest average (passing → "Menor prom").
    expect(screen.getByText('Menor prom: 4.50')).toBeTruthy()
    expect(screen.getByText('Aprobando')).toBeTruthy()
  })

  it('flags a failing course as at risk and shows unachievable targets', () => {
    const failing = makeCourse({
      name: 'Física I',
      credits: 3,
      partials: [
        makePartial({ grade: 1.5, percent: 60 }),
        makePartial({ id: 'p2', name: 'Corte 2', grade: null, percent: 40 }),
      ],
    })

    render(<StatsView courses={[failing]} passingGrade={3} maxGrade={5} />)

    // Average 1.50 < 3 → failing; needs (3 - 0.9)/0.4 = 5.25 > 5 → unachievable.
    expect(screen.getAllByText('Física I').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Reprobando: 1.50')).toBeTruthy()
    expect(screen.getByText('Meta inalcanzable')).toBeTruthy()
    expect(screen.getByText('Riesgo')).toBeTruthy()
    expect(screen.getByText('⚠️ Requiere atención')).toBeTruthy()
  })

  it('labels the weekly load chart with totals and per-day rows', () => {
    const course = makeCourse({
      schedules: [
        makeSchedule({ id: 's1', day: 'Lunes', startTime: '08:00', endTime: '10:00' }),
        makeSchedule({ id: 's2', day: 'Martes', startTime: '14:00', endTime: '15:00' }),
      ],
    })

    render(<StatsView courses={[course]} />)

    const chart = screen.getByRole('img', {
      name: 'Gráfico de carga horaria semanal. Total: 3.0 horas de clase distribuidas en 2 días.',
    })
    expect(chart).toBeTruthy()
    expect(screen.getByLabelText('Lunes: 2.0 horas de clase')).toBeTruthy()
    expect(screen.getByLabelText('Martes: 1.0 horas de clase')).toBeTruthy()
    expect(screen.getByLabelText('Viernes: Día libre')).toBeTruthy()
    expect(screen.getByLabelText('Domingo: Día libre')).toBeTruthy()
  })
})
