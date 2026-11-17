import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Box, Camera, Check, ChevronLeft, ClipboardCheck, FileText, ImageUp, MapPin, PackagePlus, Pencil, Plus, ScanLine, Search, Sparkles, Trash2, X } from 'lucide-react'
import { Annotator, LiveCamera, Scanner, SignaturePad } from './devices'
import { divisions, eligibleRobot, emptyMaterial, families, formatGps, movementLabels, newMovementId, normalizeSerial, statuses } from './domain'
import type { Division, EvidencePhoto, Family, Gps, Material, Movement, MovementType, PhotoKind, Robot, Snapshot } from './domain'
import { compressImage, getGps, stampPhoto, toBlob } from './media'
import { BlobImage, Empty, Modal, MovementGlyph, RobotStatusTag } from './ui'
import { getSupervisorName } from './profile'

export interface MovementPreset { type: MovementType; robot?: Robot }
type DraftPhoto = EvidencePhoto & { source: Blob }
const steps = ['Movimiento', 'Activos', 'Evidencia', 'Incidencias', 'Firma']

export function Wizard({ preset, snapshot, close, commit }: {
  preset: MovementPreset; snapshot: Snapshot; close: () => void
  commit: (movement: Movement, newRobots: Robot[]) => Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [type, setType] = useState(preset.type)
  const [project, setProject] = useState(preset.robot?.current_project_id ?? '')
  const [supervisor, setSupervisor] = useState(getSupervisorName)
  const [gps, setGps] = useState<Gps | null>(null)
  const [locating, setLocating] = useState(false)
  const [selected, setSelected] = useState<string[]>(preset.robot ? [preset.robot.id] : [])
  const [newRobots, setNewRobots] = useState<Robot[]>([])
  const [addingRobot, setAddingRobot] = useState(false)
  const [search, setSearch] = useState('')
  const [scanning, setScanning] = useState(false)
  const [kind, setKind] = useState<PhotoKind>('Material')
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [camera, setCamera] = useState(false)
  const [annotation, setAnnotation] = useState<DraftPhoto | null>(null)
  const [ocrId, setOcrId] = useState('')
  const [ocrNote, setOcrNote] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const upload = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorNotice = useRef<HTMLParagraphElement>(null)
  const movementId = useRef(newMovementId())
  const serials = [...snapshot.robots, ...(type === 'ENTRADA_HUB' ? newRobots : [])]
  const available = serials.filter(robot => eligibleRobot(robot, type, project || null))
  const activeRobots = available.filter(robot => selected.includes(robot.id))
  const visibleRobots = available.filter(robot => normalizeSerial(`${robot.name} ${robot.serial_number} ${robot.system_family}`).includes(normalizeSerial(search)))
  const effectivePhoto = photos.find(photo => photo.id === ocrId) ?? [...photos].reverse().find(photo => photo.kind === 'Albarán') ?? photos.at(-1)
  const blocked = busy || progress !== null
  const projectLabel = snapshot.projects.find(item => item.id === project)?.name ?? 'Hub Central'

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [step])

  useEffect(() => {
    if (error) errorNotice.current?.scrollIntoView({ block: 'center' })
  }, [error])

  async function capture(source: Blob, photoKind: PhotoKind = kind) {
    const at = new Date().toISOString()
    setCamera(false)
    setError('')
    setBusy(true)
    try {
      const optimized = await compressImage(source)
      const location = gps ?? await getGps()
      if (location) setGps(location)
      const image = await stampPhoto(optimized, { timestamp: at, projectId: project || null, gps: location, supervisor: supervisor.trim() })
      setPhotos(items => [...items, { id: crypto.randomUUID(), source: optimized, image, kind: photoKind, captured_at: at, gps_coords: location, note: '', affected_robot_ids: [] }])
      if (photoKind === 'Albarán') setOcrId('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo añadir la imagen.')
    } finally {
      setBusy(false)
    }
  }

  async function analyze() {
    if (!effectivePhoto) return
    setError('')
    setOcrNote('')
    setOcrText('')
    setProgress(0)
    try {
      const { analyzeImage } = await import('./ocr')
      const result = await analyzeImage(effectivePhoto.source, setProgress)
      if (result.materials.length) {
        setMaterials(items => [
          ...items.filter(item => !result.materials.some(match => match.sku === item.sku)),
          ...result.materials,
        ])
      }
      setOcrNote(result.materials.length
        ? `${result.mode} · ${result.materials.length} referencias detectadas. Revisa las cantidades.`
        : `${result.mode} · Sin referencias del catálogo. Prueba con una foto más nítida o añade las líneas a mano.`)
      setOcrText(result.text ?? '')
    } catch {
      setError('El análisis no se pudo completar. Puedes volver a intentarlo o añadir los materiales a mano.')
    } finally {
      setProgress(null)
    }
  }

  function toggleRobot(id: string) {
    if (selected.includes(id) && photos.some(photo => photo.affected_robot_ids.includes(id))) {
      setError('Edita o elimina primero la evidencia asociada a este activo.')
      return
    }
    setError('')
    setSelected(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id])
  }

  function readRobot(raw: string) {
    const robot = serials.find(item => normalizeSerial(item.serial_number) === normalizeSerial(raw))
    if (!robot) { setSearch(normalizeSerial(raw)); return 'Serie desconocida. En una entrada puedes darla de alta.' }
    if (!available.some(item => item.id === robot.id)) return `${robot.name} no está disponible para este movimiento.`
    setSelected(items => items.includes(robot.id) ? items : [...items, robot.id])
    return `${robot.name} añadido a la selección.`
  }

  function updateMaterial(index: number, value: Partial<Material>) {
    setMaterials(items => items.map((item, position) => position === index ? { ...item, ...value } : item))
  }

  function validMaterials() {
    return materials.every(item => item.description.trim() && item.sku.trim() && Number.isSafeInteger(item.quantity) && item.quantity > 0)
  }

  async function advance() {
    setError('')
    if (step === 0) {
      if (!supervisor.trim()) return setError('Indica el nombre del supervisor.')
      if (type === 'SALIDA_A_PROYECTO' && !project) return setError('Selecciona el proyecto de destino.')
      localStorage.setItem('vdl-supervisor', supervisor.trim())
      setSelected(activeRobots.map(robot => robot.id))
    }
    if (step === 2 && !validMaterials()) return setError('Completa la referencia, descripción y cantidad de cada material.')
    if (step === 2 && !activeRobots.length && !materials.length && !photos.length) {
      return setError('Añade al menos un activo, material o foto.')
    }
    if (step === 3 && photos.some(photo => photo.kind === 'Incidencia' && activeRobots.length && !photo.affected_robot_ids.length)) {
      return setError('Asigna los activos afectados en las fotos de incidencia.')
    }
    setStep(value => value + 1)
  }

  function back() {
    if (step === 0) { setConfirmExit(true); return }
    if (step === 4) setSigned(false)
    setError('')
    setStep(value => value - 1)
  }

  async function finalize() {
    const canvas = document.getElementById('signature-pad') as HTMLCanvasElement | null
    if (!signed || !canvas) return setError('Falta la firma de conformidad.')
    if (selected.length !== activeRobots.length) return setError('Un activo ha dejado de estar disponible. Vuelve a la selección y revísala.')
    setError('')
    setBusy(true)
    try {
      const timestamp = new Date().toISOString()
      const movement: Movement = {
        id: movementId.current, type, project_id: project || null, supervisor_name: supervisor.trim(),
        timestamp, gps_coords: gps, robots_involved: activeRobots.map(robot => robot.id),
        materials_detected: materials.map(item => ({ ...item, sku: item.sku.trim(), description: item.description.trim(), category: item.category.trim() })),
        photos: photos.map(({ source: _source, ...photo }) => photo),
        carrier_signature: await toBlob(canvas, 'image/png'), sync_status: 'pending_offline',
      }
      await commit(movement, newRobots.filter(robot => selected.includes(robot.id)))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el movimiento.')
    } finally { setBusy(false) }
  }

  const incidentCount = photos.filter(photo => photo.kind === 'Incidencia').length
  const metadataLocked = photos.length > 0
  return <div className="wizard">
    <button className="text-link back-link" type="button" disabled={blocked} onClick={() => setConfirmExit(true)}><ChevronLeft size={18} />Salir del registro</button>
    <div className="page-heading">
      <div><h1>Nuevo movimiento</h1><p>{movementLabels[type]}</p></div>
      <MovementGlyph type={type} />
    </div>
    <div className="step-caption"><span>Paso {step + 1} de {steps.length}</span><strong>{steps[step]}</strong></div>
    <ol className="stepper" aria-label="Progreso del registro">
      {steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={index < step ? 'complete' : index === step ? 'current' : ''}><span className="sr-only">Paso {index + 1}, {label}</span></li>)}
    </ol>
    <section className="panel wizard-panel">
      <header className="section-heading"><div><h2 ref={heading} tabIndex={-1}>{['Datos del movimiento', 'Seleccionar activos', 'Auditoría fotográfica', 'Incidencias visuales', 'Firma de conformidad'][step]}</h2>
        <p>{['Indica el destino u origen y quién supervisa el registro.', 'Escanea varios códigos seguidos o selecciona las unidades.', 'Fotografía el palé y el albarán. Cada evidencia incluye un sello técnico.', 'Marca daños sobre la foto y asigna los activos afectados.', 'El transportista o responsable de implantación debe firmar en pantalla.'][step]}</p></div></header>
      {step === 0 && <div className="form-stack">
        <fieldset className="fieldset" disabled={metadataLocked}>
          <legend>Tipo de movimiento</legend>
          <div className="type-grid">
            {(Object.keys(movementLabels) as MovementType[]).map(option => <button type="button" key={option} className={`type-option ${type === option ? 'selected' : ''}`} aria-pressed={type === option} onClick={() => { setType(option); if (option !== preset.type) setProject('') }}>
              <MovementGlyph type={option} />{movementLabels[option]}
            </button>)}
          </div>
          <label className="field"><span>{type === 'SALIDA_A_PROYECTO' ? 'Proyecto de destino' : 'Proyecto de origen'}</span>
            <select value={project} onChange={event => setProject(event.target.value)} required={type === 'SALIDA_A_PROYECTO'}>
              <option value="">{type === 'SALIDA_A_PROYECTO' ? 'Seleccionar proyecto' : 'Hub Central / sin proyecto'}</option>
              {snapshot.projects.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
            </select>
          </label>
          <label className="field"><span>Supervisor</span><input value={supervisor} onChange={event => setSupervisor(event.target.value)} maxLength={80} placeholder="Nombre y apellidos" /></label>
        </fieldset>
        {metadataLocked && <p className="notice">El proyecto y el supervisor ya están en los sellos. Elimina las fotos para cambiarlos.</p>}
        <div className="inline-actions">
          <button type="button" className="button secondary" disabled={locating} onClick={async () => {
            setLocating(true); setGps(await getGps()); setLocating(false)
          }}><MapPin size={17} />{locating ? 'Obteniendo GPS…' : 'Obtener GPS'}</button>
          <span className="muted">{formatGps(gps)}</span>
        </div>
      </div>}
      {step === 1 && <div className="form-stack">
        <div className="inline-actions">
          <button type="button" className="button primary" onClick={() => setScanning(true)}><ScanLine size={18} />Escanear en ráfaga</button>
          {type === 'ENTRADA_HUB' && <button type="button" className="button secondary" onClick={() => setAddingRobot(true)}><Plus size={18} />Dar de alta activo</button>}
          <span className="tag orange"><Box size={14} />{activeRobots.length} seleccionados</span>
        </div>
        <label className="search-field"><Search size={17} /><input aria-label="Buscar activos" placeholder="Buscar por nombre o serie" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="selection-list">
          {visibleRobots.map(robot => <label className="select-robot" key={robot.id}>
            <input type="checkbox" checked={selected.includes(robot.id)} onChange={() => toggleRobot(robot.id)} />
            <span><strong>{robot.name}</strong><small>{robot.serial_number} · {robot.system_family}</small></span><RobotStatusTag status={robot.status} />
          </label>)}
          {!visibleRobots.length && <Empty title="Sin activos disponibles" detail="Modifica la búsqueda o continúa para auditar solo material." />}
        </div>
      </div>}
      {step === 2 && <div className="form-stack">
        <div className="evidence-tools">
          <label className="field"><span>Tipo de foto</span><select value={kind} onChange={event => setKind(event.target.value as PhotoKind)}>
            {['Material', 'Albarán', 'Incidencia'].map(option => <option key={option}>{option}</option>)}
          </select></label>
          <button type="button" className="button primary" disabled={blocked} onClick={() => setCamera(true)}><Camera size={18} />Tomar foto</button>
          <button type="button" className="button secondary" disabled={blocked} onClick={() => upload.current?.click()}><ImageUp size={18} />Subir foto</button>
          <button type="button" className="button subtle" disabled={blocked} onClick={async () => {
            setBusy(true)
            try { const { demoDocument } = await import('./seed'); await capture(await demoDocument(), 'Albarán') }
            catch { setError('No se pudo cargar el albarán de prueba.'); setBusy(false) }
          }}><FileText size={17} />Albarán de prueba</button>
          <input className="hidden" type="file" ref={upload} accept="image/*" onChange={event => {
            const file = event.currentTarget.files?.[0]
            if (file) void capture(file)
            event.currentTarget.value = ''
          }} />
        </div>
        {busy && <p className="notice" role="status">Preparando la evidencia y el sello técnico…</p>}
        {photos.length > 0 && <div className="photo-grid">
          {photos.map((photo, index) => <div className={`photo-card ${effectivePhoto?.id === photo.id ? 'chosen' : ''}`} key={photo.id}>
            <button type="button" aria-pressed={effectivePhoto?.id === photo.id} className="photo-select" disabled={blocked} onClick={() => setOcrId(photo.id)}><BlobImage blob={photo.image} alt={`${photo.kind} ${index + 1}`} /><span>{photo.kind} {index + 1}</span></button>
            <button type="button" className="icon-button" aria-label={`Eliminar foto ${index + 1}`} disabled={blocked} onClick={() => setPhotos(items => items.filter(item => item.id !== photo.id))}><Trash2 size={16} /></button>
          </div>)}
        </div>}
        <div className="ocr-block">
          <div><strong>Lectura de albarán y palé</strong><p>{effectivePhoto ? `Foto seleccionada · ${effectivePhoto.kind} ${photos.findIndex(photo => photo.id === effectivePhoto.id) + 1}` : 'Añade una foto para detectar referencias y cantidades.'}</p></div>
          <button type="button" className="button secondary" onClick={() => void analyze()} disabled={!effectivePhoto || blocked}><Sparkles size={18} />{progress === null ? 'Analizar con IA/OCR' : `Analizando ${progress}%`}</button>
        </div>
        {ocrNote && <p className="notice" role="status">{ocrNote}</p>}
        {ocrText && <details className="ocr-details"><summary>Texto leído en la foto</summary><pre>{ocrText}</pre></details>}
        <div className="section-heading"><h3>Materiales auditados</h3><button type="button" className="button subtle" onClick={() => setMaterials(items => [...items, emptyMaterial()])} disabled={blocked}><Plus size={18} />Añadir línea</button></div>
        {!materials.length && <p className="muted">Aún no hay líneas de material.</p>}
        {materials.map((item, index) => <div className="material-row" key={index}>
          <label className="field"><span>SKU</span><input value={item.sku} onChange={event => updateMaterial(index, { sku: event.target.value })} /></label>
          <label className="field"><span>Descripción</span><input value={item.description} onChange={event => updateMaterial(index, { description: event.target.value })} /></label>
          <label className="field"><span>Categoría</span><input value={item.category} onChange={event => updateMaterial(index, { category: event.target.value })} /></label>
          <label className="field"><span>Unidades</span><input type="number" min="1" step="1" value={item.quantity || ''} onChange={event => updateMaterial(index, { quantity: Number(event.target.value) })} /></label>
          <label className="field"><span>Estado de caja</span><select value={item.box_condition} onChange={event => updateMaterial(index, { box_condition: event.target.value as Material['box_condition'] })}><option>Conforme</option><option>Revisar</option><option>Dañada</option></select></label>
          <button type="button" className="icon-button" aria-label={`Eliminar material ${index + 1}`} onClick={() => setMaterials(items => items.filter((_, position) => position !== index))}><X size={18} /></button>
        </div>)}
      </div>}
      {step === 3 && <div className="form-stack">
        {!photos.length && <Empty title="Sin fotos para anotar" detail="Vuelve a Evidencia si necesitas registrar un daño." />}
        {photos.length > 0 && <div className="photo-grid">{photos.map(photo => <div className="photo-card incident-photo" key={photo.id}>
          <BlobImage blob={photo.image} alt={photo.kind} />
          <div><span className={`tag ${photo.kind === 'Incidencia' ? 'red' : 'neutral'}`}>{photo.kind}</span><button type="button" className="button subtle" onClick={() => setAnnotation(photo)}><Pencil size={15} />{photo.kind === 'Incidencia' ? 'Editar' : 'Marcar'}</button></div>
          {photo.note && <p className="muted">{photo.note}</p>}
        </div>)}</div>}
        {incidentCount > 0 && <p className="notice">{incidentCount} {incidentCount === 1 ? 'evidencia de incidencia' : 'evidencias de incidencia'}</p>}
      </div>}
      {step === 4 && <div className="form-stack">
        <div className="review"><ClipboardCheck size={24} /><div><strong>{movementLabels[type]} · {projectLabel}</strong><p>Activos {activeRobots.length} · Materiales {materials.length} · Fotos {photos.length} · Incidencias {incidentCount}</p></div></div>
        <SignaturePad onChange={setSigned} />
        <p className="muted">El movimiento y las evidencias se guardan en este dispositivo.</p>
      </div>}
      {error && <p ref={errorNotice} className="notice error" role="alert">{error}</p>}
      <footer className="wizard-footer">
        <button type="button" className="button secondary" disabled={blocked} onClick={back}><ArrowLeft size={17} />{step === 0 ? 'Cancelar' : 'Atrás'}</button>
        <button type="button" className="button primary" disabled={blocked || locating} onClick={() => void (step === 4 ? finalize() : advance())}>
          {step === 4 ? <>{busy ? 'Guardando…' : 'Guardar movimiento'} <Check size={18} /></> : <>Continuar <ArrowRight size={18} /></>}
        </button>
      </footer>
    </section>
    {scanning && <Scanner close={() => setScanning(false)} onRead={readRobot} burst />}
    {addingRobot && <NewRobot initial={search.startsWith('VDL-') ? search : ''} existing={serials} close={() => setAddingRobot(false)} save={robot => {
      setNewRobots(items => [...items, robot]); setSelected(items => [...items, robot.id]); setSearch(''); setAddingRobot(false)
    }} />}
    {camera && <LiveCamera close={() => setCamera(false)} capture={image => void capture(image)} />}
    {annotation && <Annotator photo={annotation} robots={activeRobots} close={() => setAnnotation(null)} save={(image, note, affected_robot_ids) => {
      setPhotos(items => items.map(photo => photo.id === annotation.id ? { ...photo, kind: 'Incidencia', image, note, affected_robot_ids } : photo))
      setAnnotation(null)
    }} />}
    {confirmExit && <Modal title="Salir del registro" close={() => setConfirmExit(false)}>
      <p className="muted">Se perderán los datos de este movimiento sin guardar.</p>
      <div className="inline-actions"><button type="button" className="button secondary" onClick={() => setConfirmExit(false)}>Seguir editando</button>
        <button type="button" className="button primary" onClick={close}>Salir y descartar</button></div>
    </Modal>}
  </div>
}

function NewRobot({ initial, existing, close, save }: { initial: string; existing: Robot[]; close: () => void; save: (robot: Robot) => void }) {
  const [serial, setSerial] = useState(initial)
  const [name, setName] = useState('')
  const [firmware, setFirmware] = useState('')
  const [family, setFamily] = useState<Family>(families[0])
  const [division, setDivision] = useState<Division>(divisions[0])
  const [error, setError] = useState('')
  return <Modal title="Alta de activo" close={close}>
    <form className="form-stack" onSubmit={event => {
      event.preventDefault()
      const id = normalizeSerial(serial)
      if (!/^[A-Z0-9][A-Z0-9._/-]{2,63}$/.test(id) || !name.trim()) return setError('Revisa la serie y el nombre del activo.')
      if (existing.some(robot => normalizeSerial(robot.serial_number) === id)) return setError('Este número de serie ya está registrado.')
      save({
        id, serial_number: id, name: name.trim(), system_family: family, division, status: statuses[0],
        current_project_id: null, firmware_version: firmware.trim() || 'Sin registrar', battery_health: null,
        hours_used: 0, lift_cycles: null, last_photo_url: null, updated_at: new Date().toISOString(),
      })
    }}>
      <label className="field"><span>Número de serie</span><input value={serial} onChange={event => setSerial(event.target.value)} required maxLength={64} /></label>
      <label className="field"><span>Nombre del activo</span><input value={name} onChange={event => setName(event.target.value)} required maxLength={80} /></label>
      <label className="field"><span>Familia</span><select value={family} onChange={event => setFamily(event.target.value as Family)}>{families.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>División</span><select value={division} onChange={event => setDivision(event.target.value as Division)}>{divisions.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>Firmware</span><input value={firmware} onChange={event => setFirmware(event.target.value)} maxLength={50} /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button primary" type="submit"><PackagePlus size={18} />Añadir al movimiento</button>
    </form>
  </Modal>
}
