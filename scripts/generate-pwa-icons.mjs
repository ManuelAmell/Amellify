import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ICONS_DIR = path.resolve(process.cwd(), 'public/icons')
const iconSvg = fs.readFileSync(path.join(ICONS_DIR, 'icon.svg'))
const iconMaskableSvg = fs.readFileSync(path.join(ICONS_DIR, 'icon-maskable.svg'))

async function generate() {
  await sharp(iconSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-192.png'))

  await sharp(iconSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512.png'))

  await sharp(iconMaskableSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512-maskable.png'))

  await sharp(iconSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'))

  console.log('PWA icons generated successfully.')
}

generate().catch((err) => {
  console.error('Failed to generate PWA icons:', err)
  process.exit(1)
})
