// Regenerate the raster icon set (favicon.ico + PNGs) from the brand SVG.
//
// Usage:  npm i -D sharp png-to-ico   (one-time)
//         node scripts/gen-icons.mjs
//
// Source of truth is public/logo.svg (app mark) and public/favicon.svg
// (simplified mark for tiny sizes). Re-run after changing either SVG.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

const logoSvg = await readFile(resolve(root, 'public/logo.svg'))
const favSvg = await readFile(resolve(root, 'public/favicon.svg'))

// Render the app mark once at high resolution, then downscale for each target.
const master = await sharp(logoSvg, { density: 1200 })
  .resize(1024, 1024, { fit: 'contain', background: transparent })
  .png()
  .toBuffer()

async function png(size, outPath) {
  await mkdir(dirname(outPath), { recursive: true })
  await sharp(master).resize(size, size).png().toFile(outPath)
  console.log('wrote', outPath)
}

await png(512, resolve(root, 'public/logo.png'))
await png(512, resolve(root, 'public/images/android-chrome-512x512.png'))
await png(192, resolve(root, 'public/images/android-chrome-192x192.png'))
await png(180, resolve(root, 'public/apple-touch-icon.png'))

// favicon.ico packs the simpler mark at 16/32/48.
const icoSizes = await Promise.all(
  [16, 32, 48].map((s) =>
    sharp(favSvg, { density: 1200 })
      .resize(s, s, { fit: 'contain', background: transparent })
      .png()
      .toBuffer()
  )
)
await writeFile(resolve(root, 'public/favicon.ico'), await pngToIco(icoSizes))
console.log('wrote public/favicon.ico')
