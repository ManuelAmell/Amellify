import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ICONS_DIR = path.resolve(process.cwd(), 'public/icons')
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Reads width/height from a PNG's IHDR chunk (bytes 16-23) without a new dependency. */
function readPngDimensions(filePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filePath)
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

// Regression coverage for the documented TODO in src/app/manifest.ts and
// src/app/layout.tsx ("Fase 3 pulido"): the PWA only shipped `any`-purpose
// SVG icons because no image-rasterization tool was available and Fase 1
// was told not to add dependencies. iOS/some Android install prompts don't
// accept SVG, so this asserts real rasterized PNGs exist at the sizes the
// manifest/layout are expected to reference.
describe('PWA rasterized icons', () => {
  it('has a 192x192 PNG icon with a valid PNG signature', () => {
    const filePath = path.join(ICONS_DIR, 'icon-192.png')
    expect(fs.existsSync(filePath)).toBe(true)

    const buffer = fs.readFileSync(filePath)
    expect(buffer.subarray(0, 8)).toEqual(PNG_MAGIC)
    const { width, height } = readPngDimensions(filePath)
    expect({ width, height }).toEqual({ width: 192, height: 192 })
  })

  it('has a 512x512 PNG icon and a 512x512 maskable PNG icon', () => {
    const iconPath = path.join(ICONS_DIR, 'icon-512.png')
    const maskablePath = path.join(ICONS_DIR, 'icon-512-maskable.png')

    expect(fs.existsSync(iconPath)).toBe(true)
    expect(fs.existsSync(maskablePath)).toBe(true)

    expect(readPngDimensions(iconPath)).toEqual({ width: 512, height: 512 })
    expect(readPngDimensions(maskablePath)).toEqual({ width: 512, height: 512 })
  })

  it('has a 180x180 apple-touch-icon PNG (iOS does not accept SVG here)', () => {
    const filePath = path.join(ICONS_DIR, 'apple-touch-icon.png')
    expect(fs.existsSync(filePath)).toBe(true)
    expect(readPngDimensions(filePath)).toEqual({ width: 180, height: 180 })
  })
})
