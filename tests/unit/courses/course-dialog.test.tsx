import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CourseDialog } from '@/components/courses/course-dialog'

// Mock server actions
vi.mock('@/lib/actions/courses', () => ({
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
  getCourses: vi.fn(async () => ({ ok: true, data: [] })),
}))

describe('CourseDialog', () => {
  it('renderiza diálogo para crear nueva materia', () => {
    // El contenido del Radix Dialog se porta a document.body: las queries
    // deben ir contra `screen`, no contra el `container` local, que queda
    // vacío aunque el diálogo esté abierto.
    render(<CourseDialog open={true} onOpenChange={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Nueva Materia' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Crear Materia' })).toBeTruthy()
    expect(screen.getByLabelText('Código *')).toBeTruthy()
  })
})
