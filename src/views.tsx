import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BatteryMedium, Box, CalendarDays, Check,
  ChevronRight, ClipboardList, Clock3, Cpu, ExternalLink, FileText, Headphones, Image, Layers3, MapPin,
  Plus, Printer, QrCode, ScanLine, Search, Truck, Warehouse,
} from 'lucide-react'
import { divisions, formatDate, formatGps, formatLongDate, formatNumber, movementLabels, statuses } from './domain'
import type { DivisionFilter, Movement, MovementType, Project, Robot, RobotStatus, Snapshot } from './domain'
import { BlobImage, Brand, DivisionGlyph, Empty, Modal, MovementGlyph, RobotStatusTag, SyncTag } from './ui'

const filters: DivisionFilter[] = ['Todos', ...divisions]
type Start = (type: MovementType, robot?: Robot) => void
type Navigate = (path: string) => void

export function DivisionTabs({ active, change }: { active: DivisionFilter; change: (filter: DivisionFilter) => void }) {
  return <div className="division-tabs" role="group" aria-label="División">
    {filters.map(filter => <button type="button" key={filter} className={active === filter ? 'filter active' : 'filter'} aria-pressed={active === filter} onClick={() => change(filter)}>
      <DivisionGlyph division={filter} size={16} />{filter}
    </button>)}
  </div>
}

export function Dashboard({ data, supervisor, division, changeDivision, start, scan, go, viewFleet }: {
  data: Snapshot; supervisor: string; division: DivisionFilter; changeDivision: (filter: DivisionFilter) => void
  start: Start; scan: () => void; go: Navigate; viewFleet: (status: RobotStatus | '') => void
}) {
  const robots = data.robots.filter(robot => division === 'Todos' || robot.division === division)
  const scoped = new Set(robots.map(robot => robot.id))
  const scopedProjects = new Set(data.projects.filter(project => project.division === division).map(project => project.id))
  const movements = data.movements.filter(item => division === 'Todos' || item.robots_involved.some(id => scoped.has(id)) || (item.project_id && scopedProjects.has(item.project_id))).slice(0, 4)
  const kpis = [
    { status: '' as const, title: 'Total de activos', note: 'Robots y módulos', icon: Layers3, tone: 'orange' },
    { status: statuses[0], title: 'En hub central', note: 'Disponibles', icon: Warehouse, tone: 'green' },
    { status: statuses[1], title: 'En proyectos', note: 'Desplegados en cliente', icon: Truck, tone: 'blue' },
    { status: statuses[2], title: 'En cuarentena', note: 'Requieren revisión', icon: AlertTriangle, tone: 'red' },
  ]
  return <div className="dashboard">
    <header className="welcome">
      <div><span className="welcome-date">{formatLongDate()}</span><h2>Hola, {supervisor}</h2></div>
      <span className="tag demo-label">Demo</span>
    </header>
    <section className="hero">
      <img className="hero-image" src={`${import.meta.env.BASE_URL}warehouse.webp`} alt="" />
      <div className="hero-content">
        <span className="hero-label">FLEET &amp; SITE CONTROL</span>
        <h1>Control<br />de flota<span>.</span></h1>
        <button type="button" className="hero-scan" onClick={scan}><ScanLine size={24} /><span><strong>Escanear pasaporte VDL</strong><small>QR, código de barras o serie</small></span><ArrowUpRight size={21} /></button>
      </div>
    </section>

    <section className="dashboard-section">
      <header className="section-heading"><h2>Acciones rápidas</h2></header>
      <div className="quick-grid">
        <button type="button" className="quick quick-primary" onClick={() => start('ENTRADA_HUB')}>
          <span className="quick-icon"><ArrowDownLeft size={22} /></span>
          <span><strong>Registrar entrada</strong><small>Recepción de activos y material</small></span><ChevronRight className="quick-next" size={19} />
        </button>
        <button type="button" className="quick" onClick={() => start('SALIDA_A_PROYECTO')}>
          <span className="quick-icon"><ArrowUpRight size={22} /></span>
          <span><strong>Salida a proyecto</strong><small>Despacho a una instalación</small></span><ChevronRight className="quick-next" size={19} />
        </button>
      </div>
    </section>

    <section className="dashboard-section">
      <header className="section-heading"><h2>Estado de la flota</h2><span className="section-count">Activos {robots.length}</span></header>
      <DivisionTabs active={division} change={changeDivision} />
      <div className="kpi-grid">
        {kpis.map(({ status, title, note, icon: Icon, tone }) => {
          const count = status ? robots.filter(robot => robot.status === status).length : robots.length
          return <button key={title} type="button" className="kpi" onClick={() => viewFleet(status)}>
            <div className="kpi-top"><span className={`glyph ${tone}`}><Icon size={20} /></span><ArrowUpRight size={16} className="kpi-arrow" /></div>
            <div className="kpi-value"><strong>{formatNumber(count)}</strong><span><span className="kpi-title">{title}</span><small>{note}</small></span></div>
          </button>
        })}
      </div>
    </section>

    <section className="dashboard-section">
      <header className="section-heading"><h2>Movimientos recientes</h2><button type="button" className="text-link" onClick={() => go('movimientos')}>Ver todos <ArrowRight size={16} /></button></header>
      <MovementList movements={movements} projects={data.projects} go={go} />
    </section>
    <p className="dashboard-owner">Arano <span>·</span> Vanderlande Fleet &amp; Site Control</p>
  </div>
}

export function FleetList({ data, division, changeDivision, status, changeStatus, go, scan }: {
  data: Snapshot; division: DivisionFilter; changeDivision: (filter: DivisionFilter) => void
  status: RobotStatus | ''; changeStatus: (status: RobotStatus | '') => void; go: Navigate; scan: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = data.robots.filter(robot => (division === 'Todos' || robot.division === division) && (!status || robot.status === status) &&
    `${robot.name} ${robot.serial_number} ${robot.system_family}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <>
    <header className="page-heading"><div><span className="eyebrow">PASAPORTES DIGITALES</span><h1>Flota de activos</h1><p>{data.robots.length} robots y módulos en tu inventario.</p></div><button type="button" className="button primary" onClick={scan}><ScanLine size={18} />Escanear</button></header>
    <div className="toolbar"><DivisionTabs active={division} change={changeDivision} /></div>
    <div className="toolbar">
      <label className="search-field"><Search size={18} /><input aria-label="Buscar en la flota" placeholder="Nombre, familia o número de serie" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Estado del activo" value={status} onChange={event => changeStatus(event.target.value as RobotStatus | '')}>
        <option value="">Todos los estados</option>{statuses.map(value => <option key={value}>{value}</option>)}
      </select>
      <span className="muted">Activos visibles {filtered.length}</span>
    </div>
    {filtered.length ? <div className="asset-grid">{filtered.map(robot => <button type="button" className="panel asset-card" key={robot.id} onClick={() => go(`activo/${encodeURIComponent(robot.id)}`)}>
      <span className="asset-top"><span className="glyph orange"><Box size={21} /></span><RobotStatusTag status={robot.status} /></span>
      <span className="asset-id">{robot.serial_number}</span><strong>{robot.name}</strong><small>{robot.system_family}</small>
      <span className="asset-footer"><DivisionGlyph division={robot.division} size={16} />{robot.division}{robot.battery_health !== null && <span className="battery-reading"><BatteryMedium size={16} />{robot.battery_health}%</span>}<ChevronRight size={17} className="asset-next" /></span>
    </button>)}</div> : <Empty title="Sin activos que coincidan" detail="Cambia la división, el estado o la búsqueda." />}
  </>
}

export function Projects({ data, go }: { data: Snapshot; go: Navigate }) {
  return <>
    <header className="page-heading"><div><span className="eyebrow">EN OBRA</span><h1>Proyectos</h1><p>{data.projects.length} instalaciones bajo control.</p></div></header>
    <div className="project-grid">{data.projects.map(project => <button type="button" className="panel project-card" key={project.id} onClick={() => go(`proyecto/${project.id}`)}>
      <span className="asset-top"><span className="glyph orange"><DivisionGlyph division={project.division} size={21} /></span>
        <span className={`tag ${project.status === 'Activo' ? 'green' : 'amber'}`}><i />{project.status}</span></span>
      <small className="asset-id">{project.id} · {project.client}</small>
      <strong>{project.name}</strong><span className="muted">{project.solution_type}</span>
      <span className="project-assets"><Box size={16} />Activos desplegados <b>{data.robots.filter(robot => robot.current_project_id === project.id).length}</b></span>
      <span className="asset-footer"><MapPin size={16} />{project.location}<ChevronRight size={17} className="asset-next" /></span>
    </button>)}</div>
  </>
}

export function ProjectView({ project, data, go }: { project: Project; data: Snapshot; go: Navigate }) {
  const associated = data.robots.filter(robot => robot.current_project_id === project.id)
  return <>
    <Back go={() => go('proyectos')}>Proyectos</Back>
    <header className="page-heading"><div><span className="asset-id">{project.id} · {project.division}</span><h1>{project.name}</h1><p><MapPin size={17} /> {project.location} · {project.solution_type}</p></div><span className="tag orange"><i />{project.status}</span></header>
    <section className="dashboard-section">
      <header className="section-heading"><h2>Activos desplegados</h2></header>
      {associated.length ? <div className="panel simple-list">{associated.map(robot => <button type="button" key={robot.id} onClick={() => go(`activo/${encodeURIComponent(robot.id)}`)}><span><strong>{robot.name}</strong><small>{robot.serial_number}</small></span><ChevronRight size={18} /></button>)}</div>
        : <Empty title="Sin activos desplegados" />}
    </section>
    <section className="dashboard-section"><header className="section-heading"><h2>Movimientos del proyecto</h2></header><MovementList movements={data.movements.filter(item => item.project_id === project.id)} projects={data.projects} go={go} /></section>
  </>
}

export function MovementList({ movements, projects, go }: { movements: Movement[]; projects: Project[]; go: Navigate }) {
  if (!movements.length) return <Empty title="Sin movimientos registrados" detail="Cuando se registre una entrada, salida o retorno aparecerá aquí." />
  return <div className="movement-table">
    {movements.map(movement => <button type="button" className="movement-row" key={movement.id} onClick={() => go(`movimiento/${movement.id}`)}>
      <span className="movement-name"><MovementGlyph type={movement.type} /><span><strong>{movementLabels[movement.type]}</strong><small>{movement.id}</small></span></span>
      <span className="movement-project">{projects.find(project => project.id === movement.project_id)?.name ?? 'Hub Central'}</span>
      <span className="movement-units"><Box size={13} />{movement.robots_involved.length}<em>{movement.robots_involved.length === 1 ? ' activo' : ' activos'}</em></span>
      <span className="movement-date">{formatDate(movement.timestamp)}</span>
      <span className="movement-sync"><SyncTag demo={movement.demo} synced={movement.sync_status === 'synced'} /></span>
      <ChevronRight size={17} className="row-next" />
    </button>)}
  </div>
}

export function Movements({ data, division, go, start }: { data: Snapshot; division: DivisionFilter; go: Navigate; start: Start }) {
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const rows = data.movements.filter(item => {
    const project = data.projects.find(candidate => candidate.id === item.project_id)
    return (!type || item.type === type) && (division === 'Todos' || project?.division === division ||
      data.robots.some(robot => robot.division === division && item.robots_involved.includes(robot.id))) &&
      `${item.id} ${item.supervisor_name} ${project?.name ?? 'Hub Central'} ${item.robots_involved.join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  })
  return <>
    <header className="page-heading"><div><span className="eyebrow">TRAZABILIDAD</span><h1>Movimientos</h1><p>Entradas, salidas y retornos de tu flota.</p></div><button type="button" className="button primary" onClick={() => start('ENTRADA_HUB')}><Plus size={18} />Nuevo movimiento</button></header>
    <div className="toolbar">
      <label className="search-field"><Search size={18} /><input aria-label="Buscar movimiento" placeholder="Movimiento, serie, proyecto o supervisor" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Tipo de movimiento" value={type} onChange={event => setType(event.target.value)}><option value="">Todos los movimientos</option>
        {Object.entries(movementLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </select>
    </div>
    <MovementList movements={rows} projects={data.projects} go={go} />
  </>
}

function Back({ go, children }: { go: () => void; children: string }) {
  return <button type="button" className="text-link back-link" onClick={go}><ArrowLeft size={17} />{children}</button>
}

export const serviceDesk = 'https://www.vanderlande.com/contact/'

export function Passport({ robot, data, go, start }: { robot: Robot; data: Snapshot; go: Navigate; start: Start }) {
  const [qr, setQr] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [support, setSupport] = useState(false)
  const [ticket, setTicket] = useState('')
  const [copied, setCopied] = useState(false)
  const movements = useMemo(() => data.movements.filter(item => item.robots_involved.includes(robot.id)), [robot.id, data.movements])
  const [preview, setPreview] = useState<{ photo: Blob; title: string } | null>(null)
  const gallery = movements.flatMap(item => item.photos.filter(photo => !photo.affected_robot_ids.length || photo.affected_robot_ids.includes(robot.id)).map(photo => ({ item, photo })))
  const project = data.projects.find(item => item.id === robot.current_project_id)
  useEffect(() => {
    let active = true
    void import('qrcode').then(({ default: generator }) => generator.toDataURL(robot.serial_number, { width: 300, margin: 2, errorCorrectionLevel: 'M' }))
      .then(url => { if (active) setQr(url) }).catch(() => { if (active) setQr('') })
    return () => { active = false }
  }, [robot.serial_number])

  return <>
    <Back go={() => go('flota')}>Flota de activos</Back>
    <header className="page-heading">
      <div><span className="asset-id">{robot.serial_number}</span><h1>{robot.name}</h1><p>{robot.system_family} · {robot.division}</p></div>
      <RobotStatusTag status={robot.status} />
    </header>
    <div className="passport-layout">
      <section className="panel passport-card">
        <header className="section-heading"><h2>Ficha técnica</h2><span className="glyph orange"><Cpu size={21} /></span></header>
        <dl className="specs">
          <div><dt><Cpu size={16} />Software de control</dt><dd>{robot.firmware_version}</dd></div>
          <div><dt><BatteryMedium size={16} />Salud de batería</dt><dd>{robot.battery_health === null ? 'Sin registro' : `${robot.battery_health}%`}</dd></div>
          <div><dt><Clock3 size={16} />Horas de uso</dt><dd>{formatNumber(robot.hours_used)} h</dd></div>
          <div><dt><Layers3 size={16} />Ciclos de elevación</dt><dd>{robot.lift_cycles === null ? 'Sin registro' : formatNumber(robot.lift_cycles)}</dd></div>
          <div><dt><MapPin size={16} />Ubicación registrada</dt><dd>{project?.name ?? 'Hub Central'}</dd></div>
          <div><dt><CalendarDays size={16} />Última actualización</dt><dd>{formatDate(robot.updated_at)}</dd></div>
        </dl>
      </section>
      <section className="panel passport-card">
        <header className="section-heading"><h2>Pasaporte VDL</h2><span className="glyph orange"><QrCode size={21} /></span></header>
        <div className="qr-preview">{qr ? <img src={qr} alt={`Código QR de ${robot.serial_number}`} /> : <QrCode size={45} />}</div>
        <button type="button" className="button secondary full-width" disabled={!qr} onClick={() => setQrOpen(true)}><QrCode size={18} />Ver y descargar QR</button>
        <button type="button" className="button secondary full-width" onClick={() => setSupport(true)}><Headphones size={18} />24/7 Service Desk</button>
        <button type="button" className="button subtle full-width" onClick={() => start('RETORNO_MANTENIMIENTO', robot)}><AlertTriangle size={17} />Registrar avería</button>
      </section>
    </div>
    <section className="dashboard-section"><header className="section-heading"><h2>Galería histórica</h2></header>
      {gallery.length ? <div className="photo-grid">{gallery.map(({ item, photo }) => <button type="button" className="photo-card gallery-button" key={photo.id} onClick={() => setPreview({ photo: photo.image, title: `${photo.kind} · ${item.id}` })}>
        <BlobImage blob={photo.image} alt={`Evidencia de ${movementLabels[item.type]}`} /><span><Image size={16} />{photo.kind} · {formatDate(photo.captured_at)}</span>
      </button>)}</div> : <Empty title="Sin evidencias fotográficas" />}
    </section>
    <section className="dashboard-section"><header className="section-heading"><h2>Historial de movimientos</h2></header><MovementList movements={movements} projects={data.projects} go={go} /></section>
    {qrOpen && <Modal title="Código QR del pasaporte" close={() => setQrOpen(false)}>
      <div className="qr-preview qr-large"><img src={qr} alt={`Código QR de ${robot.serial_number}`} /></div>
      <a className="button primary full-width" href={qr} download={`${robot.serial_number}.png`}>Descargar PNG</a>
    </Modal>}
    {support && <Modal title="24/7 Service Desk" close={() => setSupport(false)}>
      <p className="muted">Prepara la descripción y pega el informe al abrir el canal oficial de atención de Vanderlande.</p>
      <label className="field"><span>Serie del activo</span><input value={robot.serial_number} readOnly /></label>
      <label className="field"><span>Descripción de la avería</span><textarea rows={4} value={ticket} onChange={event => { setTicket(event.target.value); setCopied(false) }} /></label>
      <div className="inline-actions">
        <button type="button" className="button secondary" onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${robot.serial_number} · ${robot.name}\nFirmware: ${robot.firmware_version}\n${ticket}`)
            setCopied(true)
          } catch { setCopied(false) }
        }}>{copied ? <><Check size={16} /> Copiado</> : 'Copiar informe'}</button>
        <a className="button primary" href={serviceDesk} target="_blank" rel="noreferrer">Abrir contacto <ExternalLink size={17} /></a>
      </div>
    </Modal>}
    {preview && <Modal title={preview.title} close={() => setPreview(null)} wide><BlobImage blob={preview.photo} alt={preview.title} className="full-photo" /></Modal>}
  </>
}

export function MovementDocument({ movement, data, go }: { movement: Movement; data: Snapshot; go: Navigate }) {
  const project = data.projects.find(item => item.id === movement.project_id)
  return <div className="document-view">
    <Back go={() => go('movimientos')}>Movimientos</Back>
    <header className="page-heading"><div><h1>Albarán visual</h1><p>{movement.id} · {movementLabels[movement.type]}</p></div>
      <button type="button" className="button primary" onClick={() => window.print()}><Printer size={18} />Imprimir / PDF</button></header>
    <article className="document-paper">
      <header className="doc-header"><Brand print /><div><span>ALBARÁN DE MOVIMIENTO</span><strong>{movement.id}</strong></div></header>
      {movement.demo && <p className="doc-demo">Registro de demostración</p>}
      <dl className="doc-details">
        <div><dt>Tipo de movimiento</dt><dd>{movementLabels[movement.type]}</dd></div>
        <div><dt>Proyecto / Ubicación</dt><dd>{project ? `${project.id} · ${project.name}` : 'Hub Central'}</dd></div>
        <div><dt>Fecha y hora</dt><dd>{formatDate(movement.timestamp)}</dd></div>
        <div><dt>Supervisor</dt><dd>{movement.supervisor_name}</dd></div>
        <div><dt>Coordenadas GPS</dt><dd>{formatGps(movement.gps_coords)}</dd></div>
        <div><dt>Sincronización</dt><dd>{movement.demo ? 'Demostración' : movement.sync_status === 'synced' ? 'Sincronizado' : 'Pendiente'}</dd></div>
      </dl>
      <section className="doc-block"><h2><Box size={18} />Activos</h2>
        {movement.robots_involved.length ? <ul>{movement.robots_involved.map(id => <li key={id}><strong>{data.robots.find(robot => robot.id === id)?.serial_number ?? id}</strong> · {data.robots.find(robot => robot.id === id)?.name ?? 'Activo'}</li>)}</ul> : <p>Sin activos asociados.</p>}
      </section>
      <section className="doc-block"><h2><ClipboardList size={18} />Materiales auditados</h2>
        {movement.materials_detected.length ? <div className="doc-table-wrap"><table><thead><tr><th>SKU</th><th>Descripción</th><th>Categoría</th><th>Uds.</th><th>Estado</th></tr></thead>
          <tbody>{movement.materials_detected.map((item, index) => <tr key={index}><td data-label="SKU">{item.sku}</td><td data-label="Descripción">{item.description}</td><td data-label="Categoría">{item.category || '—'}</td><td data-label="Unidades">{item.quantity}</td><td data-label="Estado">{item.box_condition}</td></tr>)}</tbody>
        </table></div> : <p>Sin líneas de material.</p>}
      </section>
      <section className="doc-block"><h2><Image size={18} />Evidencias</h2>
        {movement.photos.length ? <div className="doc-photos">{movement.photos.map(photo => <figure key={photo.id}><BlobImage blob={photo.image} alt={photo.kind} />
          <figcaption>{photo.kind} · {formatDate(photo.captured_at)}{photo.note && <span>{photo.note}</span>}{!!photo.affected_robot_ids.length && <span>Activos afectados: {photo.affected_robot_ids.join(', ')}</span>}</figcaption></figure>)}</div> : <p>Sin evidencia fotográfica.</p>}
      </section>
      <section className="doc-block"><h2><FileText size={18} />Firma de conformidad</h2>
        {movement.carrier_signature ? <BlobImage className="doc-signature" blob={movement.carrier_signature} alt="Firma manuscrita de conformidad" /> : <p>Sin firma registrada.</p>}
      </section>
    </article>
  </div>
}
