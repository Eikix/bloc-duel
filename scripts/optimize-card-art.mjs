import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const MAX_WIDTH = 960
const WEBP_QUALITY = 76

const cardsDir = path.resolve(process.cwd(), 'public/cards')
const files = (await readdir(cardsDir))
  .filter((file) => file.endsWith('.png'))
  .sort((a, b) => a.localeCompare(b))

if (files.length === 0) {
  console.log('No PNG card art found in public/cards')
  process.exit(0)
}

let totalBefore = 0
let totalAfter = 0

for (const file of files) {
  const inputPath = path.join(cardsDir, file)
  const outputPath = path.join(cardsDir, file.replace(/\.png$/i, '.webp'))

  await sharp(inputPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, alphaQuality: 92, effort: 5 })
    .toFile(outputPath)

  const before = (await stat(inputPath)).size
  const after = (await stat(outputPath)).size
  totalBefore += before
  totalAfter += after

  const saved = before > 0 ? (((before - after) / before) * 100).toFixed(1) : '0.0'
  console.log(`${file} -> ${path.basename(outputPath)} | ${(before / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB | -${saved}%`)
}

const totalSaved = totalBefore > 0 ? (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1) : '0.0'
console.log(`total | ${(totalBefore / 1024 / 1024).toFixed(2)} MB -> ${(totalAfter / 1024 / 1024).toFixed(2)} MB | -${totalSaved}%`)
