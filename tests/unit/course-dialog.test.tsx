import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { CourseDialog } from '@/components/courses/course-dialog'
import { createCourse, deleteCourse, updateCourse } from '@/lib/actions/courses'
import { toast } from 'sonner'
import { makeCourse, makeSchedule } from './helpers/fixtures'

// The dialog mounts a `'use server'` actions module; under jsdom there is no
// Next.js server runtime behind it, so it is mocked out here.
vi.mock('@/lib/actions/courses', () => ({
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
  duplicateCourse: vi.fn(),
  getCourses: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const CALC = makeCourse()
// Con el fixture por defecto no hay cruces: Lunes 08:00-10:00, sin vecinos.
const NO_CONFLICT = [makeCourse({ id: 'course-9', code: 'OTRA1', name: 'Otra Materia', status: 'paused' })]

type DialogProps = Omit<Parameters<typeof CourseDialog>[0], 'open'>

function renderDialog(
  props: Omit<Partial<DialogProps>, 'onOpenChange'> & { onOpenChange: (open: boolean) => void }
) {
  return render(<CourseDialog open {...props} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createCourse).mockResolvedValue({ ok: true, data: makeCourse({ id: 'course-new' }) })
  vi.mocked(updateCourse).mockResolvedValue({ ok: true, data: makeCourse() })
  vi.mocked(deleteCourse).mockResolvedValue({ ok: true, data: { id: 'course-1' } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CourseDialog', () => {
  it('renders the create form with default values when opened without a course', () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange, existingCourses: NO_CONFLICT })

    expect(screen.getByRole('heading', { name: 'Nueva Materia' })).toBeTruthy()
    expect((screen.getByLabelText('Código *') as HTMLInputElement).value).toBe('')
    expect(screen.getByDisplayValue('3')).toBeTruthy() // créditos por defecto
    expect(screen.getByDisplayValue('08:00')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Crear Materia' })).toBeTruthy()
    // Schedule section starts with exactly one block.
    expect(screen.getAllByTitle('Eliminar este bloque').length).toBe(1)
  })

  it('requires code and name before submitting anything to the server', async () => {
    renderDialog({ onOpenChange: vi.fn(), existingCourses: NO_CONFLICT })

    fireEvent.click(screen.getByRole('button', { name: 'Crear Materia' }))

    expect(await screen.findByText('El código es obligatorio.')).toBeTruthy()
    expect(screen.getByText('El nombre es obligatorio.')).toBeTruthy()
    expect(createCourse).not.toHaveBeenCalled()
  })

  it('populates every field in edit mode', () => {
    renderDialog({ onOpenChange: vi.fn(), existingCourses: NO_CONFLICT, initialCourse: CALC })

    expect(screen.getByRole('heading', { name: 'Editar Materia' })).toBeTruthy()
    expect(screen.getByDisplayValue('CALC1')).toBeTruthy()
    expect(screen.getByDisplayValue('Cálculo I')).toBeTruthy()
    expect(screen.getByDisplayValue('Gabriel Chanchi')).toBeTruthy()
    expect(screen.getByDisplayValue('08:00')).toBeTruthy()
    expect(screen.getByDisplayValue('10:00')).toBeTruthy()
    expect(screen.getByDisplayValue('A-101')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eliminar Materia' })).toBeTruthy()
  })

  it('adds and removes schedule blocks', () => {
    renderDialog({ onOpenChange: vi.fn(), existingCourses: NO_CONFLICT })

    expect(screen.getAllByPlaceholderText('Salón / Aula (ej: A-301)').length).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Agregar Bloque/ }))
    expect(screen.getAllByPlaceholderText('Salón / Aula (ej: A-301)').length).toBe(2)

    fireEvent.click(screen.getAllByTitle('Eliminar este bloque')[0]!)
    expect(screen.getAllByPlaceholderText('Salón / Aula (ej: A-301)').length).toBe(1)
  })

  it('flags overlapping blocks of the same course in real time (H12 internals)', () => {
    const clashing = makeCourse({
      schedules: [
        makeSchedule({ id: 's1', day: 'Lunes', startTime: '08:00', endTime: '10:00' }),
        makeSchedule({ id: 's2', day: 'Lunes', startTime: '09:00', endTime: '11:00' }),
      ],
    })
    renderDialog({ onOpenChange: vi.fn(), existingCourses: [clashing], initialCourse: clashing })

    expect(screen.getByText('Solape interno con el bloque #2 (Lunes 09:00 - 11:00).')).toBeTruthy()
    expect(screen.getByText('Solape interno con el bloque #1 (Lunes 08:00 - 10:00).')).toBeTruthy()
  })

  it('warns when the schedule clashes with another active course, ignoring paused ones', () => {
    const neighbor = makeCourse({
      id: 'course-2',
      code: 'FIS2',
      name: 'Física II',
      schedules: [makeSchedule({ id: 's9', day: 'Lunes', startTime: '09:00', endTime: '10:00', room: 'B-201' })],
    })
    renderDialog({
      onOpenChange: vi.fn(),
      existingCourses: [CALC, neighbor],
      initialCourse: CALC,
    })

    expect(
      screen.getAllByText(/Coincide con "Física II" \[FIS2\]: Lunes 09:00 a 10:00 \(Salón B-201\)/).length
    ).toBe(1)
    expect(screen.queryByText(/Coincide con "Otra Materia"/)).toBeNull()
  })

  it('submits a valid create payload with normalized code and closes itself', async () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange, existingCourses: NO_CONFLICT })

    fireEvent.change(screen.getByLabelText('Código *'), { target: { value: 'prue' } })
    fireEvent.change(screen.getByLabelText('Nombre de la materia *'), {
      target: { value: 'Cálculo Vectorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear Materia' }))

    await waitFor(() => {
      expect(createCourse).toHaveBeenCalledTimes(1)
    })
    const payload = vi.mocked(createCourse).mock.calls[0]![0] as {
      course: { code: string; name: string; credits: number; status: string; color: string }
      schedules: Array<{ day: string; startTime: string; endTime: string; room?: string }>
    }
    expect(payload.course).toMatchObject({
      code: 'PRUE', // trim().toUpperCase()
      name: 'Cálculo Vectorial',
      credits: 3,
      status: 'active',
      color: 'blue',
    })
    expect(payload.schedules).toEqual([{ day: 'Lunes', startTime: '08:00', endTime: '10:00', room: undefined }])

    expect(toast.success).toHaveBeenCalledWith('Materia creada con éxito')
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('submits an update keeping the course id', async () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange, existingCourses: NO_CONFLICT, initialCourse: CALC })

    fireEvent.change(screen.getByLabelText('Nombre de la materia *'), {
      target: { value: 'Cálculo Avanzado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(updateCourse).toHaveBeenCalledTimes(1)
    })
    const payload = vi.mocked(updateCourse).mock.calls[0]![0] as {
      id: string
      course: { name: string; code: string }
      schedules: Array<{ id?: string; day: string }>
    }
    expect(payload.id).toBe('course-1')
    expect(payload.course.name).toBe('Cálculo Avanzado')
    expect(payload.course.code).toBe('CALC1')
    expect(payload.schedules[0]).toMatchObject({ id: 'sched-1', day: 'Lunes' })
    expect(toast.success).toHaveBeenCalledWith('Materia actualizada con éxito')
  })

  it('deletes the course from the dialog after window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange, existingCourses: NO_CONFLICT, initialCourse: CALC })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Materia' }))

    await waitFor(() => {
      expect(deleteCourse).toHaveBeenCalledTimes(1)
    })
    expect(confirmSpy.mock.calls[0]![0]).toContain('Cálculo I')
    expect(toast.success).toHaveBeenCalledWith('Materia eliminada con éxito')
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('cancels through the Cancel button without server calls', () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange, existingCourses: NO_CONFLICT, initialCourse: CALC })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(createCourse).not.toHaveBeenCalled()
    expect(updateCourse).not.toHaveBeenCalled()
    expect(deleteCourse).not.toHaveBeenCalled()
  })
})
