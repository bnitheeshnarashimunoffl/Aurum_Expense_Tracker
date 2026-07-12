import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, '..', 'public', 'icon-source.svg')
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')

const svg = readFileSync(SOURCE)

const targets = [
  { name: 'icon-1024.png', size: 1024 },
  { name: 'apple-touch-icon-180.png', size: 180 },
  { name: 'apple-touch-icon-167.png', size: 167 },
  { name: 'apple-touch-icon-152.png', size: 152 },
  { name: 'apple-touch-icon-120.png', size: 120 },
  { name: 'pwa-512.png', size: 512 },
  { name: 'pwa-192.png', size: 192 },
]

for (const { name, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .flatten({ background: '#0B0D10' }) // no alpha — iOS home-screen icons must be fully opaque
    .png()
    .toFile(path.join(OUT_DIR, name))
  console.log(`Wrote ${name} (${size}x${size})`)
}
