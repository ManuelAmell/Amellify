import { test, expect } from '@playwright/test'
import { registerAndLogin, createTestCourse } from './helpers/auth'

test.describe('Vista de Estadísticas', () => {
  test('carga sin materias registradas sin romperse', async ({ page }) => {
    await registerAndLogin(page)

    await page.goto('/stats')
    await page.waitForLoadState('domcontentloaded')

    // No crash / no error boundary shown for the empty-state case.
    await expect(page.locator('body')).toBeVisible()
    await expect(page.getByText(/error/i)).not.toBeVisible()
  })

  test('muestra estadísticas después de crear una materia', async ({ page }) => {
    await registerAndLogin(page)
    await createTestCourse(page, 'Física Mecánica', 'FIS201')

    await page.goto('/stats')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('Física Mecánica')).toBeVisible()
  })
})
