import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Box, Check, CircleHelp, CloudOff, Plane, Warehouse, X } from 'lucide-react'
import { statusLabel, statuses } from './domain'
import type { DivisionFilter, MovementType, RobotStatus } from './domain'

export const divisionIcons = { Todos: Box, Almacenamiento: Warehouse, Paquetería: Box, Aeropuertos: Plane }
export const movementIcons = { ENTRADA_HUB: ArrowDownLeft, SALIDA_A_PROYECTO: ArrowUpRight, RETORNO_MANTENIMIENTO: AlertTriangle }
export const moveTone = { ENTRADA_HUB: 'green', SALIDA_A_PROYECTO: 'orange', RETORNO_MANTENIMIENTO: 'red' }

export function Brand({ print = false }: { print?: boolean }) {
  return <div className={print ? 'brand brand-print' : 'brand'}>
    <span className="wordmark">VANDERLANDE</span>
    <span className="brand-line" />
    <span className="brand-byline">a <b>TOYOTA AUTOMATED LOGISTICS</b> company</span>
  </div>
}

export function DivisionGlyph({ division, size = 18 }: { division: DivisionFilter; size?: number }) {
  const Icon = divisionIcons[division]
  return <Icon size={size} />
}

export function MovementGlyph({ type }: { type: MovementType }) {
  const Icon = movementIcons[type]
  return <span className={`glyph ${moveTone[type]}`}><Icon size={19} /></span>
}

export function RobotStatusTag({ status }: { status: RobotStatus }) {
  return <span className={`tag ${status === statuses[0] ? 'green' : status === statuses[1] ? 'orange' : 'red'}`}><i />{statusLabel[status]}</span>
}

export function SyncTag({ synced, demo }: { synced: boolean; demo?: boolean }) {
  return demo ? <span className="tag neutral"><i />Demo</span> : synced
    ? <span className="tag green"><Check size={13} />Sincronizado</span>
    : <span className="tag amber"><CloudOff size={13} />Pendiente</span>
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return <div className="empty"><CircleHelp size={27} /><strong>{title}</strong>{detail && <p>{detail}</p>}</div>
}

export function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) { setUrl(''); return }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

export function BlobImage({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const url = useBlobUrl(blob)
  return url ? <img src={url} alt={alt} className={className} /> : null
}

export function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useRef(`dialog-${crypto.randomUUID()}`)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} aria-labelledby={titleId.current} className={wide ? 'modal modal-wide' : 'modal'}
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="modal-inner">
      <span className="sheet-handle" aria-hidden="true" />
      <header className="modal-header"><h2 id={titleId.current}>{title}</h2>
        <button type="button" className="icon-button" onClick={close} aria-label="Cerrar"><X size={21} /></button>
      </header>
      <div className="modal-body">{children}</div>
    </div>
  </dialog>
}
