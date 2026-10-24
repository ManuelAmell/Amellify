import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Un NODE_ENV=production heredado del shell hace que Vite trate los tests como cliente y que React omita act().
process.env.NODE_ENV = 'test'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Los tests de componentes montan jsdom por archivo; en máquinas cargadas 5s se queda corto.
    testTimeout: 15_000,
    env: { NODE_ENV: 'test' },
    include: ['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/db/queries/**'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
