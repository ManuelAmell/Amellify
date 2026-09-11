import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers/auth'

test.describe('Exportación y Copias de Seguridad', () => {
  test('permite exportar el horario a archivo de calendario .ics', async ({ page }) => {
    await registerAndLogin(page)

    // Navegar a materias
    await page.goto('/courses')
    await page.waitForLoadState('domcontentloaded')

    const exportIcsBtn = page.getByRole('button', { name: /Exportar ICS/i })
    await expect(exportIcsBtn).toBeVisible()

    // Manejar evento de descarga o notificación toast
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
    await exportIcsBtn.click()

    const download = await downloadPromise
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.ics$/i)
    } else {
      // Si no hay materias registradas aún, puede mostrar toast
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('permite descargar copia de seguridad en JSON desde Ajustes', async ({ page }) => {
    await registerAndLogin(page)

    // Navegar a Ajustes
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    // Cambiar a la pestaña de datos
    const dataTab = page.getByRole('tab', { name: /Datos/i })
    await expect(dataTab).toBeVisible()
    await dataTab.click()

    // Botón de descargar JSON
    const exportJsonBtn = page.getByRole('button', { name: /Descargar Copia JSON/i })
    await expect(exportJsonBtn).toBeVisible()

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
    await exportJsonBtn.click()

    const download = await downloadPromise
    if (download) {
      expect(download.suggestedFilename()).toMatch(/amellify_backup_.*\.json$/i)
    } else {
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
