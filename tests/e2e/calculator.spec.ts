import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers/auth'

test.describe('Calculadora de Notas y Simulador de Aprobación', () => {
  test('carga la interfaz de la calculadora y muestra métricas clave', async ({ page }) => {
    await registerAndLogin(page)

    // Navegar a la calculadora
    await page.goto('/calculator')
    await page.waitForLoadState('domcontentloaded')

    // Verificar encabezado y tarjetas de métricas
    await expect(page.getByText('Promedio Acumulado')).toBeVisible()
    await expect(page.getByText(/¿Qué nota necesito\?/i)).toBeVisible()
    await expect(page.getByText(/Desglose de Cortes y Evaluaciones/i)).toBeVisible()
  })

  test('permite interactuar con los campos de notas y porcentajes', async ({ page }) => {
    await registerAndLogin(page)
    await page.goto('/calculator')
    await page.waitForLoadState('domcontentloaded')

    // Verificar presencia de inputs de nota si hay cortes disponibles
    const gradeInputs = page.locator('input[type="number"]')
    const count = await gradeInputs.count()
    expect(count).toBeGreaterThan(0)
  })
})
