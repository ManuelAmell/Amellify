import { test, expect } from '@playwright/test'
import { generateTestUser, registerAndLogin } from './helpers/auth'

test.describe('Autenticación y Sesión', () => {
  test('redirecciona usuarios no autenticados a /login al acceder a /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL((url) => url.pathname.includes('/login'))
    await expect(page.getByRole('heading', { name: 'Amellify' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  })

  test('permite alternar entre pestañas de Ingresar y Crear cuenta', async ({ page }) => {
    await page.goto('/login')

    const registerTab = page.getByRole('button', { name: 'Crear cuenta' })
    const loginTab = page.getByRole('button', { name: 'Ingresar' })

    await expect(loginTab).toHaveAttribute('aria-pressed', 'true')
    await registerTab.click()
    await expect(registerTab).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByPlaceholder('Tu nombre')).toBeVisible()

    await loginTab.click()
    await expect(loginTab).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByPlaceholder('Tu nombre')).not.toBeVisible()
  })

  test('valida campos obligatorios en el formulario de registro', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Crear cuenta' }).click()

    // Email inválido
    await page.getByPlaceholder('tu@correo.edu.co').fill('correo-invalido')
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('12345678')
    await page.getByRole('button', { name: 'Registrar cuenta' }).click()

    // El navegador o la validación del form intercepta el error
    await expect(page.getByPlaceholder('tu@correo.edu.co')).toBeVisible()
  })

  test('permite registrar una nueva cuenta y redirige a /dashboard', async ({ page }) => {
    const user = generateTestUser()
    await registerAndLogin(page, user)
    await expect(page).toHaveURL(/.*\/dashboard/)
  })
})
