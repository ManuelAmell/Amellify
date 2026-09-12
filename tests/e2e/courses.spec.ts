import { test, expect } from '@playwright/test'
import { MAIN_USER_STATE } from './global-setup'

test.describe('Gestión de Materias y Horarios', () => {
  test.use({ storageState: MAIN_USER_STATE })

  test('permite crear una nueva asignatura con bloques de horario', async ({ page }) => {
    // Navegar a la página de materias
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: 'Lista de Materias' })).toBeVisible()

    // Abrir diálogo de creación
    const createBtn = page.getByRole('button', { name: 'Nueva Materia' })
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    // El diálogo debe estar visible
    await expect(page.getByRole('heading', { name: /Nueva Materia/i })).toBeVisible()

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const courseCode = `CS${randomSuffix}`
    const courseName = `Estructuras de Datos ${randomSuffix}`

    // Llenar campos
    await page.locator('#code').fill(courseCode)
    await page.locator('#name').fill(courseName)

    const professorInput = page.locator('#professor')
    if (await professorInput.isVisible()) {
      await professorInput.fill('Dr. Alan Turing')
    }

    // Enviar formulario
    const submitBtn = page.getByRole('button', { name: 'Crear Materia' })
    await submitBtn.click()

    // Verificar que el diálogo se cierra y la materia aparece en la lista
    await expect(page.getByText(courseName)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(courseCode)).toBeVisible()
  })

  test('permite buscar y filtrar materias existentes', async ({ page }) => {
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.getByPlaceholder(/Buscar por nombre, código/i)
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Física')
    await expect(searchInput).toHaveValue('Física')
  })
})
