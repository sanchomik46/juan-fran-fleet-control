import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Camera, ImageUp, ScanLine, Trash2 } from 'lucide-react'
import { Modal } from './ui'
import { loadImage, toBlob } from './media'
import type { EvidencePhoto, Robot } from './domain'
import type { IScannerControls } from '@zxing/browser'

export function Scanner({ close, onRead, burst = false }: { close: () => void; onRead: (text: string) => string; burst?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const callback = useRef(onRead)
  callback.current = onRead
  const [camera, setCamera] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const last = useRef({ code: '', when: 0 })

  useEffect(() => {
    if (!camera) return
    let controls: IScannerControls | undefined
    let disposed = false
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible')
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (disposed || !video.current) return
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanSuccess: 550 })
        controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, video.current, result => {
          if (!result || disposed) return
          const decoded = result.getText()
          const now = Date.now()
          if (last.current.code === decoded && now - last.current.when < 3000) return
          last.current = { code: decoded, when: now }
          setMessage(callback.current(decoded))
        })
        if (disposed) controls.stop()
      } catch {
        if (!disposed) {
          setMessage('No se pudo abrir la cámara. Prueba con una foto o escribe el número de serie.')
          setCamera(false)
        }
      }
    })()
    return () => { disposed = true; controls?.stop() }
  }, [camera])

  const decodeFile = async (image: File) => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const result = await new BrowserMultiFormatReader().decodeFromImageElement(await loadImage(image))
      setMessage(onRead(result.getText()))
    } catch {
      setMessage('No se encontró un código legible en la foto.')
    }
  }

  return <Modal title={burst ? 'Escaneo en ráfaga' : 'Escanear pasaporte VDL'} close={close}>
    <p className="muted">Lee un código QR o de barras de la flota, o introduce la serie.</p>
    <div className="viewfinder">
      {camera ? <video ref={video} autoPlay muted playsInline /> : <ScanLine size={44} />}
      {camera && <span className="scan-frame" />}
    </div>
    <div className="inline-actions">
      <button type="button" className="button primary" onClick={() => setCamera(value => !value)}><Camera size={18} />{camera ? 'Detener cámara' : 'Activar cámara'}</button>
      <button type="button" className="button secondary" onClick={() => file.current?.click()}><ImageUp size={18} />Leer foto</button>
      <input type="file" ref={file} accept="image/*" className="hidden" onChange={event => {
        const image = event.currentTarget.files?.[0]
        if (image) void decodeFile(image)
        event.currentTarget.value = ''
      }} />
    </div>
    <form className="manual-code" onSubmit={event => { event.preventDefault(); setMessage(onRead(code)); if (burst) setCode('') }}>
      <label className="field"><span>Número de serie</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="VDL-ADP-2026-089" autoCapitalize="characters" required /></label>
      <button className="button secondary" type="submit">{burst ? 'Añadir' : 'Buscar'}</button>
    </form>
    {message && <p className="notice" role="status">{message}</p>}
    {burst && <button type="button" className="button secondary full-width" onClick={close}>Finalizar escaneo</button>}
  </Modal>
}

export function LiveCamera({ close, capture }: { close: () => void; capture: (image: Blob) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const native = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let stream: MediaStream | undefined
    let disposed = false
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error()
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (disposed || !video.current) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        video.current.srcObject = stream
      } catch {
        if (!disposed) setError('La cámara integrada no está disponible. Usa la cámara del dispositivo o elige un archivo.')
      }
    })()
    return () => { disposed = true; stream?.getTracks().forEach(track => track.stop()) }
  }, [])

  const take = async () => {
    const source = video.current
    if (!source?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = source.videoWidth
    canvas.height = source.videoHeight
    canvas.getContext('2d')!.drawImage(source, 0, 0)
    try { capture(await toBlob(canvas)) }
    catch { setError('No se pudo capturar la imagen. Prueba con la cámara del dispositivo.') }
  }

  return <Modal title="Capturar evidencia" close={close}>
    {!error && <div className="viewfinder"><video ref={video} autoPlay muted playsInline onLoadedMetadata={() => setActive(true)} /></div>}
    {error && <p className="notice" role="status">{error}</p>}
    <div className="inline-actions">
      {active && !error && <button type="button" className="button primary" onClick={() => void take()}><Camera size={18} />Tomar foto</button>}
      <button type="button" className="button secondary" onClick={() => native.current?.click()}><Camera size={18} />Cámara del dispositivo</button>
      <input type="file" ref={native} accept="image/*" capture="environment" className="hidden" onChange={event => {
        const photo = event.currentTarget.files?.[0]
        if (photo) capture(photo)
      }} />
    </div>
  </Modal>
}

function useDrawing(color: string, marginBottom = 0) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const current = useRef<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const coordinates = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * event.currentTarget.width / rect.width,
      y: Math.min((event.clientY - rect.top) * event.currentTarget.height / rect.height, event.currentTarget.height - marginBottom),
    }
  }
  return {
    canvas, dirty, setDirty,
    events: {
      onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
        if (current.current !== null || event.button !== 0) return false
        const point = coordinates(event)
        if (point.y >= event.currentTarget.height - marginBottom) return false
        current.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        const ctx = event.currentTarget.getContext('2d')!
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(3, event.currentTarget.width / 155)
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(point.x, point.y)
        ctx.lineTo(point.x + 0.4, point.y + 0.4)
        ctx.stroke()
        setDirty(true)
        return true
      },
      onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
        if (current.current !== event.pointerId) return
        const point = coordinates(event)
        const ctx = event.currentTarget.getContext('2d')!
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(point.x, point.y)
      },
      onLostPointerCapture() { current.current = null },
    },
  }
}

export function SignaturePad({ onChange }: { onChange: (value: boolean) => void }) {
  const drawing = useDrawing('#1e2229')

  return <div className="signature-area">
    <div className="signature-paper">
      <canvas id="signature-pad" ref={drawing.canvas} width={1000} height={600} aria-label="Área táctil de firma" {...drawing.events}
        onPointerDown={event => { if (drawing.events.onPointerDown(event)) onChange(true) }} />
      <span>Firma aquí</span>
    </div>
    <button type="button" className="button subtle" onClick={() => {
      const element = drawing.canvas.current!
      element.getContext('2d')!.clearRect(0, 0, element.width, element.height)
      drawing.setDirty(false)
      onChange(false)
    }}><Trash2 size={16} />Borrar firma</button>
  </div>
}

export function Annotator({ photo, robots, close, save }: {
  photo: EvidencePhoto; robots: Robot[]; close: () => void
  save: (image: Blob, note: string, affected: string[]) => void
}) {
  const [color, setColor] = useState('#ef4444')
  const [note, setNote] = useState(photo.note)
  const [affected, setAffected] = useState(photo.affected_robot_ids.length ? photo.affected_robot_ids : robots.length === 1 ? [robots[0].id] : [])
  const [image, setImage] = useState<HTMLImageElement>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const drawing = useDrawing(color, (image?.width ?? 0) * 0.116 + 5)
  useEffect(() => {
    let mounted = true
    void loadImage(photo.image).then(value => { if (mounted) setImage(value) }, failure => { if (mounted) setError(failure.message) })
    return () => { mounted = false }
  }, [photo.image])
  useEffect(() => {
    if (image) drawing.canvas.current?.getContext('2d')!.drawImage(image, 0, 0)
  }, [image, drawing.canvas])

  const confirm = async () => {
    if (!drawing.canvas.current || busy) return
    if (!drawing.dirty && !note.trim() && photo.kind !== 'Incidencia') return setError('Dibuja una marca o describe la incidencia.')
    if (robots.length && !affected.length) return setError('Indica qué activos quedan en cuarentena.')
    setBusy(true)
    try { save(await toBlob(drawing.canvas.current), note.trim(), affected) }
    catch { setError('No se pudo guardar la imagen anotada.') }
    finally { setBusy(false) }
  }
  return <Modal title="Marcar incidencia" close={close} wide>
    <p className="muted">Dibuja sobre la foto y señala los activos que deben pasar a cuarentena.</p>
    {image && <canvas className="annotation-canvas" aria-label="Superficie de dibujo sobre la foto" ref={drawing.canvas} width={image.width} height={image.height} {...drawing.events} />}
    <div className="inline-actions">
      <button type="button" className={`button secondary ${color === '#ef4444' ? 'chosen' : ''}`} onClick={() => setColor('#ef4444')}><i className="swatch red" />Rojo</button>
      <button type="button" className={`button secondary ${color === '#f48025' ? 'chosen' : ''}`} onClick={() => setColor('#f48025')}><i className="swatch orange" />Naranja</button>
      <button type="button" className="button subtle" onClick={() => {
        if (image) drawing.canvas.current?.getContext('2d')!.drawImage(image, 0, 0)
        drawing.setDirty(false)
      }}>Deshacer trazos nuevos</button>
    </div>
    <label className="field"><span>Descripción de la incidencia</span><textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={300} /></label>
    {robots.map(robot => <label key={robot.id} className="check-row"><input type="checkbox" checked={affected.includes(robot.id)} onChange={event => setAffected(event.target.checked ? [...affected, robot.id] : affected.filter(id => id !== robot.id))} />{robot.name}</label>)}
    {error && <p className="notice error" role="alert">{error}</p>}
    <button type="button" className="button primary" disabled={busy || !image} onClick={() => void confirm()}>Guardar incidencia</button>
  </Modal>
}
