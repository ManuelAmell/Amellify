import { test, expect } from '@playwright/test'
import { registerAndLogin, createTestCourse } from './helpers/auth'

test.describe('Calculadora de Notas y Simulador de Aprobación', () => {
  test('muestra estado vacío cuando el estudiante no tiene materias registradas', async ({ page }) => {
    await registerAndLogin(page)

    await page.goto('/calculator')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('No tienes materias registradas')).toBeVisible()
    await expect(page.getByText(/Crea primero tus materias en la sección de Materias/i)).toBeVisible()
  })

  test('carga la interfaz de la calculadora y muestra métricas clave al existir materias', async ({ page }) => {
    await registerAndLogin(page)
    await createTestCourse(page, 'Cálculo Vectorial', 'CALCVEC')

    // Navegar a la calculadora
    await page.goto('/calculator')
    await page.waitForLoadState('domcontentloaded')

    // Verificar encabezado y tarjetas de métricas
    await expect(page.getByText('Promedio Acumulado')).toBeVisible()
    await expect(page.getByText(/¿Qué nota necesito\?/i)).toBeVisible()
    await expect(page.getByText(/Total de Porcentajes/i)).toBeVisible()
    await expect(page.getByText(/Notas Parciales/i)).toBeVisible()
  })

  test('permite interactuar con los campos de notas y porcentajes', async ({ page }) => {
    await registerAndLogin(page)
    await createTestCourse(page, 'Física Mecánica', 'FIS101')

    await page.goto('/calculator')
    await page.waitForLoadState('domcontentloaded')

    // Verificar presencia de inputs de nota si hay cortes disponibles
    const gradeInputs = page.locator('input[type="number"]')
    const count = await gradeInputs.count()
    expect(count).toBeGreaterThan(0)
  })
})
