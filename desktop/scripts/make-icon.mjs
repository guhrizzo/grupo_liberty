// Gera assets/icon.png (1024x1024) e assets/icon.ico a partir do wordmark da
// marca. É um ícone PROVISÓRIO — o logo oficial é retangular (721x280) e não
// serve como ícone quadrado. Substitua colocando um `assets/icon.source.png`
// quadrado (>=1024px) que este script usa no lugar do wordmark.

import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dir, '..')
const assets = path.join(root, 'assets')
const custom = path.join(assets, 'icon.source.png')
const wordmark = path.join(root, '..', 'app', 'public', 'logo-liberty-car-blue.png')
const outPng = path.join(assets, 'icon.png')
const outIco = path.join(assets, 'icon.ico')

const SIZE = 1024
const BG = { r: 11, g: 13, b: 20, alpha: 1 } // #0b0d14

await mkdir(assets, { recursive: true })

const hasCustom = await access(custom).then(() => true).catch(() => false)

let square
if (hasCustom) {
  square = await sharp(await readFile(custom))
    .resize(SIZE, SIZE, { fit: 'cover' })
    .png()
    .toBuffer()
} else {
  const logo = await sharp(await readFile(wordmark))
    .resize({ width: Math.round(SIZE * 0.74), fit: 'contain' })
    .toBuffer()
  square = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer()
}

await writeFile(outPng, square)

const sizes = [16, 24, 32, 48, 64, 128, 256]
const frames = await Promise.all(
  sizes.map((s) => sharp(square).resize(s, s).png().toBuffer()),
)
await writeFile(outIco, await pngToIco(frames))

console.log(`ícone ${hasCustom ? '(custom)' : '(provisório)'} gerado:`)
console.log(' ', outPng)
console.log(' ', outIco)
