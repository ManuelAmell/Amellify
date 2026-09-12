import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PORT ?? 3000
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  // In CI, the compose stack is brought up separately (see ci.yml) and this
  // is skipped via PLAYWRIGHT_BASE_URL; locally it boots the standalone
  // server (next.config.ts sets `output: 'standalone'`, and `next start`
  // doesn't work against that build at all) against whatever DATABASE_URL
  // is already configured. Requires `pnpm build` to have run first.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm run start:standalone',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
