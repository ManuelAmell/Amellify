import path from 'node:path'
import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers/auth'

test.describe('Restaurar datos desde copia de seguridad JSON', () => {
  test('importa una materia desde un backup JSON válido y la muestra en Materias', async ({
    page,
  }) => {
    await registerAndLogin(page)

    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('tab', { name: /Datos/i }).click()

    const fileInput = page.locator('input[type="file"][accept*="json"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'backup-sample.json'))

    await expect(page.getByText(/importación completada/i)).toBeVisible({ timeout: 10_000 })

    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('Cálculo Diferencial (restaurado)')).toBeVisible()
  })

  test('muestra un error y no crea nada cuando el JSON no cumple el schema', async ({ page }) => {
    await registerAndLogin(page)

    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('tab', { name: /Datos/i }).click()

    const fileInput = page.locator('input[type="file"][accept*="json"]')
    await fileInput.setInputFiles({
      name: 'invalid-backup.json',
      mimeType: 'application/json',
      // Missing the required `course.code` field.
      buffer: Buffer.from(JSON.stringify({ courses: [{ course: { name: 'Sin código' } }] })),
    })

    await expect(page.getByText(/no son válidos|inválid/i)).toBeVisible({ timeout: 10_000 })

    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('Sin código')).not.toBeVisible()
  })
})
