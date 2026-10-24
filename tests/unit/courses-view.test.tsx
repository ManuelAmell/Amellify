import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoursesView } from '@/components/courses/courses-view'
import { deleteCourse, duplicateCourse, getCourses } from '@/lib/actions/courses'
import { generateICS } from '@/lib/ics-export'
import { toast } from 'sonner'
import { makeCourse, makeSchedule } from './helpers/fixtures'

// `useSearchParams` needs a router-capable Next.js runtime; a plain
// `URLSearchParams` stand-in keeps the deep-link behavior testable in jsdom.
const navParams = vi.hoisted(() => ({ params: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  useSearchParams: () => navParams.params,
}))

// `'use server'` actions cannot be invoked outside Next's server runtime.
vi.mock('@/lib/actions/courses', () => ({
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
  duplicateCourse: vi.fn(),
  getCourses: vi.fn(),
}))

vi.mock('@/lib/ics-export', () => ({
  generateICS: vi.fn(() => 'BEGIN:VCALENDAR\nEND:VCALENDAR\n'),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const CALC = makeCourse()
const STAT = makeCourse({
  id: 'course-2',
  code: 'ESTAT',
  name: 'Estadística',
  status: 'paused',
  professor: 'Laura Restrepo',
  credits: 4,
  schedules: [makeSchedule({ id: 'sched-2', day: 'Miércoles', startTime: '14:00', endTime: '16:00', room: 'B-201' })],
})

beforeEach(() => {
  vi.clearAllMocks()
  navParams.params = new URLSearchParams()
  // CourseDialog fetches the list when opened without the existingCourses
  // prop (CoursesView never passes it) — give it a server-result shape.
  vi.mocked(getCourses).mockResolvedValue({ ok: true, data: [CALC, STAT] })
  // Deep-link smooth scrolling is absent in jsdom.
  Element.prototype.scrollIntoView = vi.fn()
})

describe('CoursesView', () => {
  it('renders the empty state when there are no courses and no filters', () => {
    render(<CoursesView initialCourses={[]} />)

    expect(screen.getByText('Lista de Materias')).toBeTruthy()
    expect(screen.getByText('No se encontraron materias')).toBeTruthy()
    expect(screen.getByText('Empieza agregando tu primera materia o importa tu horario con IA.')).toBeTruthy()
  })

  it('renders course cards with professor, schedule, status and credits', () => {
    render(<CoursesView initialCourses={[CALC, STAT]} />)

    const calcCard = document.getElementById('course-card-course-1') as HTMLElement
    expect(calcCard).toBeTruthy()
    expect(within(calcCard).getAllByText('CALC1').length).toBe(1)
    expect(within(calcCard).getAllByText('Activa').length).toBe(1)
    expect(within(calcCard).getAllByText('Gabriel Chanchi').length).toBe(1)
    expect(within(calcCard).getByText('Horarios (1)')).toBeTruthy()
    expect(within(calcCard).getByText('Lunes')).toBeTruthy()
    expect(within(calcCard).getByText('08:00 - 10:00')).toBeTruthy()
    expect(within(calcCard).getByText('A-101')).toBeTruthy()
    expect(within(calcCard).getByText('3 créditos')).toBeTruthy()

    const statCard = document.getElementById('course-card-course-2') as HTMLElement
    expect(within(statCard).getAllByText('Pausada').length).toBe(1)
    expect(within(statCard).getByText('14:00 - 16:00')).toBeTruthy()
    expect(within(statCard).getByText('B-201')).toBeTruthy()
  })

  it('shows the no-professor and no-schedule placeholders on sparse cards', () => {
    const sparse = makeCourse({
      id: 'course-3',
      professor: '',
      schedules: [],
    })
    render(<CoursesView initialCourses={[sparse]} />)

    const card = document.getElementById('course-card-course-3') as HTMLElement
    expect(within(card).getByText('Sin docente asignado')).toBeTruthy()
    expect(within(card).getByText('Sin horario registrado')).toBeTruthy()
    expect(within(card).getByText('Horarios (0)')).toBeTruthy()
  })

  it('filters by search text and shows a filtered-out empty state', () => {
    render(<CoursesView initialCourses={[CALC, STAT]} />)
    const search = screen.getByPlaceholderText('Buscar por nombre, código, profesor o facultad...') as HTMLInputElement

    fireEvent.change(search, { target: { value: 'zzz-nada' } })
    expect(screen.getByText('No se encontraron materias')).toBeTruthy()
    expect(screen.getByText('Intenta con otro término de búsqueda o restablece los filtros.')).toBeTruthy()

    // By name.
    fireEvent.change(search, { target: { value: 'Cálculo' } })
    expect(screen.getByText('Cálculo I')).toBeTruthy()
    expect(screen.queryByText('Estadística')).toBeNull()

    // By professor and by code too.
    fireEvent.change(search, { target: { value: 'Gabriel' } })
    expect(screen.getByText('Cálculo I')).toBeTruthy()
    expect(screen.queryByText('Estadística')).toBeNull()

    fireEvent.change(search, { target: { value: 'ESTAT' } })
    expect(screen.getByText('Estadística')).toBeTruthy()
    expect(screen.queryByText('Cálculo I')).toBeNull()
  })

  it('deletes a course after confirmation and removes it optimistically', async () => {
    vi.mocked(deleteCourse).mockResolvedValueOnce({ ok: true, data: { id: 'course-2' } })
    render(<CoursesView initialCourses={[CALC, STAT]} />)

    const statCard = document.getElementById('course-card-course-2') as HTMLElement
    fireEvent.click(within(statCard).getByTitle('Eliminar materia'))

    // The accessible confirmation dialog names the course.
    expect(screen.getByRole('heading', { name: '¿Eliminar materia?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar materia' }))

    await waitFor(() => {
      expect(screen.queryByText('Estadística')).toBeNull()
    })
    expect(deleteCourse).toHaveBeenCalledWith('course-2')
    expect(toast.success).toHaveBeenCalledWith('Materia "Estadística" eliminada')
  })

  it('reverts the optimistic deletion when the action fails', async () => {
    vi.mocked(deleteCourse).mockResolvedValueOnce({ ok: false, error: 'Sin permisos' })
    render(<CoursesView initialCourses={[CALC, STAT]} />)

    const statCard = document.getElementById('course-card-course-2') as HTMLElement
    fireEvent.click(within(statCard).getByTitle('Eliminar materia'))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar materia' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sin permisos')
    })
    // The card is restored to the list after the failure.
    expect(screen.getByText('Estadística')).toBeTruthy()
  })

  it('duplicates a course via the server action and lists the copy', async () => {
    vi.mocked(duplicateCourse).mockResolvedValueOnce({
      ok: true,
      data: makeCourse({
        id: 'course-3',
        code: 'CALC1-2',
        schedules: [],
      }),
    })
    render(<CoursesView initialCourses={[CALC]} />)

    const calcCard = document.getElementById('course-card-course-1') as HTMLElement
    fireEvent.click(within(calcCard).getByTitle('Duplicar materia'))

    await waitFor(() => {
      expect(screen.getByText('CALC1-2')).toBeTruthy()
    })
    expect(duplicateCourse).toHaveBeenCalledWith('course-1')
    expect(toast.success).toHaveBeenCalledWith('Materia duplicada con éxito')
  })

  it('reports an error toast when duplicating fails', async () => {
    vi.mocked(duplicateCourse).mockResolvedValueOnce({ ok: false, error: 'Código ya usado' })
    render(<CoursesView initialCourses={[CALC]} />)

    const calcCard = document.getElementById('course-card-course-1') as HTMLElement
    fireEvent.click(within(calcCard).getByTitle('Duplicar materia'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Código ya usado')
    })
    // No optimistic duplicate is left behind.
    expect(screen.queryByText('CALC1-2')).toBeNull()
  })

  it('exports the horario as ICS through the browser download flow', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    ;(window.URL as unknown as Record<string, unknown>).createObjectURL = createObjectURL
    ;(window.URL as unknown as Record<string, unknown>).revokeObjectURL = revokeObjectURL

    render(<CoursesView initialCourses={[CALC, STAT]} />)
    fireEvent.click(screen.getByRole('button', { name: /Exportar ICS/ }))

    expect(generateICS).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Horario exportado en formato .ics')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('opens the edit dialog and highlights the card for a ?course= deep link', async () => {
    navParams.params = new URLSearchParams('course=course-1')
    render(<CoursesView initialCourses={[CALC, STAT]} />)

    expect(await screen.findByRole('heading', { name: 'Editar Materia' })).toBeTruthy()
    const calcCard = document.getElementById('course-card-course-1') as HTMLElement
    expect(calcCard.className).toContain('ring-2')
  })

  it("opens the create dialog from the 'Nueva Materia' button", () => {
    render(<CoursesView initialCourses={[CALC]} />)

    fireEvent.click(screen.getByRole('button', { name: /Nueva Materia/ }))
    expect(screen.getByRole('heading', { name: 'Nueva Materia' })).toBeTruthy()
  })

  it("opens the create dialog from the empty state's 'Agregar Materia' button", () => {
    render(<CoursesView initialCourses={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Agregar Materia/ }))
    expect(screen.getByRole('heading', { name: 'Nueva Materia' })).toBeTruthy()
  })
})
