import path from 'node:path'
import { chromium, type FullConfig } from '@playwright/test'
import { registerAndLogin, generateTestUser } from './helpers/auth'

/**
 * Better Auth rate-limits /sign-up and /sign-in to 3 requests per 10s per IP
 * by default in production (node_modules/better-auth's
 * `getDefaultSpecialRules`) - and our e2e webServer boots a production
 * build (see playwright.config.ts). Every spec previously called
 * `registerAndLogin` for its own fresh throwaway user, so a handful of
 * specs running back-to-back easily tripped that limit and hung waiting
 * for the post-signup redirect (found while auditing feature/project-polish
 * - the failures always traced back to registerAndLogin's waitForURL
 * timeout).
 *
 * Fix: register a small, fixed set of reusable users exactly ONCE here,
 * save their sessions as Playwright storageState files, and have specs
 * load the appropriate one via `test.use({ storageState: ... })` instead
 * of signing up themselves. This drops the whole suite's real sign-up
 * count to 2 (plus the one intentionally-live signup in auth.spec.ts,
 * which tests the signup flow itself and must keep doing a real one) -
 * comfortably under the 3-per-10s ceiling regardless of how many spec
 * files exist.
 *
 * Two users, not one, because some assertions specifically require an
 * account with zero courses (calculator/stats "empty state" tests) and
 * would break if another test had already added a course to a shared
 * account first.
 */
export const EMPTY_USER_STATE = path.join(__dirname, '.auth/empty-user.json')
export const MAIN_USER_STATE = path.join(__dirname, '.auth/main-user.json')

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'
  const browser = await chromium.launch()

  try {
    const emptyContext = await browser.newContext({ baseURL })
    const emptyPage = await emptyContext.newPage()
    await registerAndLogin(emptyPage, generateTestUser())
    await emptyContext.storageState({ path: EMPTY_USER_STATE })
    await emptyContext.close()

    const mainContext = await browser.newContext({ baseURL })
    const mainPage = await mainContext.newPage()
    await registerAndLogin(mainPage, generateTestUser())
    await mainContext.storageState({ path: MAIN_USER_STATE })
    await mainContext.close()
  } finally {
    await browser.close()
  }
}
