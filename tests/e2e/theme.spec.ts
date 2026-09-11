import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers/auth'

test.describe('Ajustes y Cambio de Tema', () => {
  test('permite cambiar entre tema claro y tema oscuro desde Ajustes', async ({ page }) => {
    await registerAndLogin(page)

    // Navegar a Ajustes
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    // Ir a la pestaña Apariencia
    const appearanceTab = page.getByRole('tab', { name: /Apariencia/i })
    await expect(appearanceTab).toBeVisible()
    await appearanceTab.click()

    // Botones de tema
    const lightBtn = page.getByRole('button', { name: /Claro/i })
    const darkBtn = page.getByRole('button', { name: /Oscuro/i })

    await expect(lightBtn).toBeVisible()
    await expect(darkBtn).toBeVisible()

    // Cambiar a Claro
    await lightBtn.click()
    await page.waitForTimeout(500)
    const isLight = await page.evaluate(() =>
      document.documentElement.classList.contains('light') ||
      document.documentElement.getAttribute('data-theme') === 'light' ||
      !document.documentElement.classList.contains('dark')
    )
    expect(isLight).toBeTruthy()

    // Cambiar a Oscuro
    await darkBtn.click()
    await page.waitForTimeout(500)
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark'
    )
    expect(isDark).toBeTruthy()
  })
})
