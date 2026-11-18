import { formatGps } from './domain'
import type { Gps } from './domain'

export function getGps(): Promise<Gps | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    // The browser's position timeout can exclude the time spent waiting for user consent.
    const timeout = window.setTimeout(() => resolve(null), 4500)
    const finish = (value: Gps | null) => {
      window.clearTimeout(timeout)
      resolve(value)
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => finish({ lat: coords.latitude, lon: coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 30_000 },
    )
  })
}

export function toBlob(canvas: HTMLCanvasElement, type = 'image/webp', quality = 0.84): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob)
    else reject(new Error('No se pudo preparar la imagen.'))
  }, type, quality))
}

export function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    const img = new Image()
    const release = () => { if (typeof source !== 'string') URL.revokeObjectURL(url) }
    img.onload = () => { release(); resolve(img) }
    img.onerror = () => { release(); reject(new Error('No se pudo abrir la foto. Prueba con JPEG, PNG o WebP.')) }
    img.src = url
  })
}

interface Stamp {
  timestamp: string
  projectId: string | null
  gps: Gps | null
  supervisor: string
}

export async function stampPhoto(source: Blob | HTMLCanvasElement, stamp: Stamp, replaceExistingBand = false): Promise<Blob> {
  const image = source instanceof Blob ? await loadImage(source) : source
  const sourceHeight = image.height - (replaceExistingBand ? Math.round(image.width / 1000 * 116) : 0)
  const ratio = Math.min(1, 1440 / Math.max(image.width, sourceHeight))
  const width = Math.max(640, Math.round(image.width * ratio))
  const height = Math.round(sourceHeight * width / image.width)
  const scale = width / 1000
  const band = Math.round(scale * 116)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height + band
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, image.width, sourceHeight, 0, 0, width, height)
  ctx.save()
  ctx.translate(0, height)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#17191c'
  ctx.fillRect(0, 0, 1000, 116)
  ctx.fillStyle = '#F48025'
  ctx.fillRect(0, 0, 1000, 5)
  ctx.fillStyle = '#fff'
  ctx.font = 'italic 900 30px sans-serif'
  ctx.fillText('VANDERLANDE', 24, 45)
  ctx.font = '21px monospace'
  ctx.fillText(`${stamp.timestamp.replace('T', ' ').slice(0, 19)} UTC · ${stamp.projectId ?? 'HUB CENTRAL'}`, 24, 75, 952)
  ctx.fillStyle = '#FECDA5'
  ctx.fillText(`${formatGps(stamp.gps)} · ${stamp.supervisor}`, 24, 102, 952)
  ctx.restore()
  return toBlob(canvas)
}

export async function compressImage(source: Blob): Promise<Blob> {
  const img = await loadImage(source)
  const ratio = Math.min(1, 1600 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * ratio))
  canvas.height = Math.max(1, Math.round(img.height * ratio))
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return toBlob(canvas)
}
