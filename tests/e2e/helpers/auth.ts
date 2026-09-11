import type { Page } from '@playwright/test'

export interface TestUser {
  name: string
  email: string
  password: string
}

export function generateTestUser(): TestUser {
  const id = Math.random().toString(36).substring(2, 9)
  return {
    name: `Estudiante ${id}`,
    email: `student_${Date.now()}_${id}@amellify.test`,
    password: `Password_${id}_1234!`,
  }
}

/**
 * Registers a fresh unique user and waits for the dashboard to load.
 */
export async function registerAndLogin(
  page: Page,
  user: TestUser = generateTestUser()
): Promise<TestUser> {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')

  // Switch to registration tab
  const createAccountTab = page.getByRole('button', { name: 'Crear cuenta' })
  await createAccountTab.click()

  // Fill in registration fields
  await page.getByPlaceholder('Tu nombre').fill(user.name)
  await page.getByPlaceholder('tu@correo.edu.co').fill(user.email)
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(user.password)

  // Submit
  await page.getByRole('button', { name: 'Registrar cuenta' }).click()

  // Wait for session and navigation to dashboard
  await page.waitForURL((url) => url.pathname.includes('/dashboard'), {
    timeout: 15_000,
  })

  return user
}
