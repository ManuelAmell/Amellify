import { test, expect } from '@playwright/test'
import { createTestCourse } from './helpers/auth'
import { EMPTY_USER_STATE, MAIN_USER_STATE } from './global-setup'

test.describe('Vista de Estadísticas', () => {
  test.describe('sin materias registradas', () => {
    test.use({ storageState: EMPTY_USER_STATE })

    test('carga sin materias registradas sin romperse', async ({ page }) => {
      await page.goto('/stats')
      await page.waitForLoadState('domcontentloaded')

      // No crash / no error boundary shown for the empty-state case.
      await expect(page.locator('body')).toBeVisible()
      await expect(page.getByText(/error/i)).not.toBeVisible()
    })
  })

  test.describe('con materias registradas', () => {
    test.use({ storageState: MAIN_USER_STATE })

    test('muestra estadísticas después de crear una materia', async ({ page }) => {
      await createTestCourse(page, 'Estadística Aplicada', 'STAT201')

      await page.goto('/stats')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByText('Estadística Aplicada')).toBeVisible()
    })
  })
})
