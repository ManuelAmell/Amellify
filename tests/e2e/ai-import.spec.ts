import path from 'node:path'
import { test, expect } from '@playwright/test'
import { MAIN_USER_STATE } from './global-setup'

const MOCK_EXTRACTION_RESPONSE = {
  courses: [
    {
      code: 'CS101',
      name: 'Algoritmos y Estructuras de Datos',
      professor: 'Juan Perez',
      email: '',
      faculty: '',
      semester: '',
      credits: 3,
      color: 'blue',
      schedules: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00', room: 'A1' }],
    },
  ],
  provider: 'Google AI',
  model: 'gemini-2.5-flash',
}

test.describe('Importar Horario con IA', () => {
  test.use({ storageState: MAIN_USER_STATE })

  test('sube una imagen, previsualiza lo extraído (mockeado) y lo guarda como materia', async ({
    page,
  }) => {
    // The AI cascade itself (Google/Groq/OpenRouter) is covered by
    // tests/unit/ai-cascade.test.ts - hitting a real free-tier provider
    // here would be slow, flaky and rate-limit-prone (confirmed live: it
    // can take minutes under high demand). This e2e covers the UI wiring
    // (upload -> analyze -> preview -> save), not the AI cascade itself.
    await page.route('**/api/ai/extract-schedule', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXTRACTION_RESPONSE),
      })
    )

    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('tab', { name: /Datos/i }).click()
    await page.getByRole('button', { name: /Abrir Escáner de IA/i }).click()

    const fileInput = page.locator('input[type="file"][accept*="image"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'tiny-schedule.png'))

    const analyzeBtn = page.getByRole('button', { name: /Analizar Horario/i })
    await expect(analyzeBtn).toBeEnabled()
    await analyzeBtn.click()

    await expect(page.getByPlaceholder('Nombre de la asignatura')).toHaveValue(
      'Algoritmos y Estructuras de Datos'
    )

    await page.getByRole('button', { name: /Confirmar e Importar/i }).click()

    await expect(page.getByText(/materia.*importada|importación completada/i)).toBeVisible({
      timeout: 10_000,
    })

    // Confirm it actually persisted, not just a toast.
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('Algoritmos y Estructuras de Datos')).toBeVisible()
  })

  test('muestra un error y no rompe la UI cuando el backend responde 503', async ({ page }) => {
    await page.route('**/api/ai/extract-schedule', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No fue posible analizar el horario en este momento.',
          attempts: [{ provider: 'google', error: 'api_error_503' }],
        }),
      })
    )

    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('tab', { name: /Datos/i }).click()
    await page.getByRole('button', { name: /Abrir Escáner de IA/i }).click()

    const fileInput = page.locator('input[type="file"][accept*="image"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'tiny-schedule.png'))
    await page.getByRole('button', { name: /Analizar Horario/i }).click()

    await expect(page.getByText('No fue posible analizar el horario en este momento.')).toBeVisible()
    // Dialog stays open and usable, not stuck in a broken loading state.
    await expect(page.getByRole('button', { name: /Analizar Horario/i })).toBeEnabled()
  })
})
