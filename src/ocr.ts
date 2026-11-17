import { createWorker, OEM, PSM } from 'tesseract.js'
import { catalog } from './catalog'
import type { Material } from './domain'
import { asDataUrl } from './db'
import { compressImage } from './media'

const endpoint = import.meta.env.VITE_VISION_ENDPOINT?.trim()
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

export function parseReferences(text: string): Material[] {
  const parts = new Map<string, Material>()
  for (const line of text.split(/\r?\n/)) {
    const normalized = ` ${normalize(line)} `
    const found = catalog.filter(entry => [entry.sku, ...entry.aliases].some(ref => normalized.includes(` ${normalize(ref)} `)))
    if (!found.length) continue
    const quantityMatch = line.match(/\b(?:QTY|UDS?|CANT(?:IDAD)?|UNITS?)\s*[:x]?\s*(\d+)\b/i)
      ?? line.match(/\b(\d+)\s*(?:UDS?|UNITS?|PCS)\.?\s*$/i)
      ?? (found.length === 1 ? line.match(/\s(\d+)\s*$/) : null)
    const quantity = Math.max(1, Math.min(999999, Number(quantityMatch?.[1] ?? 1)))
    for (const { sku, description, category } of found) {
      const previous = parts.get(sku)
      parts.set(sku, { sku, description, category, quantity: quantity + (previous?.quantity ?? 0), box_condition: 'Conforme' })
    }
  }
  return [...parts.values()]
}

function readVisionResponse(value: unknown): Material[] {
  if (!Array.isArray(value)) throw new Error('Respuesta de visión incompleta.')
  return value.map(row => {
    const { sku, description, category, quantity, box_condition } = row ?? {}
    if (typeof sku !== 'string' || !sku.trim() || typeof description !== 'string' || !description.trim() ||
        typeof category !== 'string' || !Number.isSafeInteger(quantity) || quantity < 1 ||
        !['Conforme', 'Revisar', 'Dañada'].includes(box_condition)) {
      throw new Error('El servicio de visión devolvió un material inválido.')
    }
    return { sku, description, category, quantity, box_condition }
  })
}

export async function analyzeImage(source: Blob, progress: (value: number) => void) {
  if (endpoint && navigator.onLine) {
    try {
      const encoded = await asDataUrl(await compressImage(source))
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: encoded, catalog }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error('Servicio de visión no disponible.')
      const result = await response.json()
      return { materials: readVisionResponse(result.materials), mode: 'Visión IA' }
    } catch {
      progress(0)
    }
  }
  const base = `${import.meta.env.BASE_URL}ocr`
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}/worker.min.js`, corePath: base, langPath: base,
    logger: message => {
      if (message.status === 'recognizing text') progress(Math.round(35 + 65 * message.progress))
      if (message.status === 'initialized api') progress(35)
    },
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' })
    const { data } = await worker.recognize(await compressImage(source))
    return { materials: parseReferences(data.text), mode: 'OCR local · Simulación', text: data.text.trim() }
  } finally {
    await worker.terminate()
  }
}
