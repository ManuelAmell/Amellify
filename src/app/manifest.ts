import type { MetadataRoute } from 'next'
import { APP_NAME, APP_DESCRIPTION } from '@/config/nav'

/**
 * Replaces the old `public/manifest.json`, which existed but was never
 * linked from `metadata` (plan finding H10) — Next never emitted a
 * `<link rel="manifest">` tag, so the PWA was never installable regardless
 * of how complete the JSON file was. `metadata.manifest` in
 * `src/app/layout.tsx` now points at the route this file generates
 * (`/manifest.webmanifest`).
 *
 * TODO(fase-3-pulido): swap the `any`-purpose SVG icon for real rasterized
 * PNGs (192x192, 512x512, plus a 512x512 `maskable` with safe-zone padding)
 * once an image-rasterization tool/dependency is available — this
 * environment has none installed and Fase 1 is explicitly told not to add
 * dependencies. iOS/some Android install prompts are picky about SVG icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Gestión de Horarios Universitarios`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#090e13',
    theme_color: '#090e13',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
