import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const tesseractRoot = dirname(require.resolve('tesseract.js/package.json'))
const tesseractRequire = createRequire(join(tesseractRoot, 'package.json'))
const coreRoot = dirname(tesseractRequire.resolve('tesseract.js-core/package.json'))
const languageRoot = dirname(require.resolve('@tesseract.js-data/eng/package.json'))
const destination = new URL('../public/ocr/', import.meta.url)
await mkdir(destination, { recursive: true })
const files = [
  [join(tesseractRoot, 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(coreRoot, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(coreRoot, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(languageRoot, '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
]
await Promise.all(files.map(([source, name]) => copyFile(source, new URL(name, destination))))
