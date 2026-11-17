import { StrictMode, lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDownUp, Box, CheckCircle2, Download, Headphones, LayoutDashboard,
  MapPinned, RefreshCw, ScanLine, Wifi, WifiOff, X,
} from 'lucide-react'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/inter'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import { onDatabaseChange, registerMovement, snapshot, syncEndpoint, syncQueue } from './db'
import { normalizeSerial } from './domain'
import type { DivisionFilter, Movement, MovementType, Robot, RobotStatus, Snapshot } from './domain'
import { Dashboard, FleetList, MovementDocument, Movements, Passport, Projects, ProjectView, serviceDesk } from './views'
import { Brand, Empty, Modal } from './ui'
import type { MovementPreset } from './wizard'
import { getSupervisorName } from './profile'
import './style.css'

const Wizard = lazy(() => import('./wizard').then(module => ({ default: module.Wizard })))
const Scanner = lazy(() => import('./devices').then(module => ({ default: module.Scanner })))
const nav = [
  { key: '', label: 'Vista general', mobile: 'Inicio', icon: LayoutDashboard },
  { key: 'flota', label: 'Flota de activos', mobile: 'Flota', icon: Box },
  { key: 'proyectos', label: 'Proyectos', mobile: 'Proyectos', icon: MapPinned },
  { key: 'movimientos', label: 'Movimientos', mobile: 'Movimientos', icon: ArrowDownUp },
] as const

interface InstallPrompt extends Event { prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }> }
const readRoute = () => window.location.hash.slice(1)

function App() {
  const [route, setRoute] = useState(readRoute)
  const [data, setData] = useState<Snapshot>()
  const [loadError, setLoadError] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [division, setDivision] = useState<DivisionFilter>('Todos')
  const [status, setStatus] = useState<RobotStatus | ''>('')
  const [scanning, setScanning] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [profile, setProfile] = useState(false)
  const [supervisorName, setSupervisorName] = useState(getSupervisorName)
  const [preset, setPreset] = useState<MovementPreset>({ type: 'ENTRADA_HUB' })
  const [returnPath, setReturnPath] = useState('')
  const [toast, setToast] = useState('')
  const [install, setInstall] = useState<InstallPrompt | null>(null)
  const [update, setUpdate] = useState<null | (() => void)>(null)

  const reload = useCallback(async () => {
    try { setData(await snapshot()); setLoadError('') }
    catch { setLoadError('El navegador no pudo abrir el almacenamiento local. Comprueba que tiene espacio y permite IndexedDB.') }
  }, [])

  useEffect(() => {
    void reload()
    return onDatabaseChange(() => void reload())
  }, [reload])

  useEffect(() => {
    const changed = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    const connection = () => setOnline(navigator.onLine)
    const offerInstall = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt) }
    const installed = () => setInstall(null)
    window.addEventListener('hashchange', changed)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    window.addEventListener('beforeinstallprompt', offerInstall)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('hashchange', changed)
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
      window.removeEventListener('beforeinstallprompt', offerInstall)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const applyUpdate = registerSW({ onNeedRefresh: () => setUpdate(() => () => void applyUpdate(true)) })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const pending = data?.movements.filter(item => item.sync_status === 'pending_offline').length ?? 0

  useEffect(() => {
    if (syncEndpoint && online && pending > 0) {
      void syncQueue().then(() => reload()).catch(() => undefined)
    }
  }, [online, pending, reload])

  const go = (path: string) => {
    if (readRoute() !== path) {
      window.location.hash = path
    } else window.scrollTo(0, 0)
    setRoute(path)
  }

  const start = (type: MovementType, robot?: Robot) => {
    setPreset({ type, robot })
    setReturnPath(route)
    go('registro')
  }

  const persist = async (movement: Movement, newRobots: Robot[]) => {
    await registerMovement(movement, newRobots)
    setSupervisorName(movement.supervisor_name)
    await reload()
    go(`movimiento/${movement.id}`)
    setToast('Movimiento guardado en el dispositivo')
  }

  const [page, key] = route.split('/')
  const currentRobot = data?.robots.find(robot => encodeURIComponent(robot.id) === key)
  const currentProject = data?.projects.find(project => project.id === key)
  const currentMovement = data?.movements.find(movement => movement.id === key)
  const activeNav = ({ activo: 'flota', proyecto: 'proyectos', movimiento: 'movimientos', registro: 'movimientos' } as Record<string, string>)[page] ?? page
  const initials = supervisorName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  const wizardActive = page === 'registro'

  let content
  if (loadError) content = <div className="form-stack"><Empty title="No se pudo cargar la flota" detail={loadError} /><button className="button secondary" onClick={() => void reload()}>Reintentar</button></div>
  else if (!data) content = <div className="loading" role="status"><RefreshCw size={21} />Cargando control de flota…</div>
  else {
    switch (page) {
      case '':
        content = <Dashboard data={data} supervisor={supervisorName} division={division} changeDivision={setDivision} start={start} scan={() => setScanning(true)} go={go} viewFleet={value => { setStatus(value); go('flota') }} />
        break
      case 'flota':
        content = <FleetList data={data} division={division} changeDivision={setDivision} status={status} changeStatus={setStatus} go={go} scan={() => setScanning(true)} />
        break
      case 'proyectos':
        content = <Projects data={data} go={go} />
        break
      case 'proyecto':
        if (currentProject) content = <ProjectView project={currentProject} data={data} go={go} />
        break
      case 'movimientos':
        content = <Movements data={data} division={division} go={go} start={start} />
        break
      case 'registro':
        content = <Wizard preset={preset} snapshot={data} close={() => go(returnPath)} commit={persist} />
        break
      case 'activo':
        if (currentRobot) content = <Passport key={currentRobot.id} robot={currentRobot} data={data} go={go} start={start} />
        break
      case 'movimiento':
        if (currentMovement) content = <MovementDocument movement={currentMovement} data={data} go={go} />
        break
    }
  }

  return <div className={`app-shell ${wizardActive ? 'wizard-active' : ''}`}>
    <div className="workspace">
      <header className="topbar">
        <button type="button" className="brand-button" onClick={() => go('')} disabled={wizardActive} aria-label="Vanderlande, página de inicio"><Brand /></button>
        <div className="user-tools">
          <button type="button" className={`connection ${online ? 'is-online' : 'is-offline'}`} onClick={() => setSyncOpen(true)} aria-label={online ? 'En línea, ver sincronización' : 'Sin conexión, ver sincronización'}>
            {online ? <Wifi size={17} /> : <WifiOff size={17} />}<span className="connection-dot" />{pending > 0 && <b>{pending}</b>}
          </button>
          <button type="button" className="profile" disabled={wizardActive} onClick={() => setProfile(true)} aria-label="Perfil de supervisor">
            <span className="avatar">{initials}</span>
          </button>
        </div>
      </header>
      <main className="content" id="contenido">
        <Suspense fallback={<div className="loading" role="status">Cargando…</div>}>
          {content ?? <div className="form-stack"><Empty title="Registro no encontrado" /><button className="button secondary" onClick={() => go('')}>Volver al inicio</button></div>}
        </Suspense>
      </main>
    </div>
    {!wizardActive && <nav className="bottom-nav" aria-label="Navegación móvil">
      {nav.map(({ key: path, mobile, icon: Icon }, index) => <button key={path} type="button" style={{ gridColumn: index < 2 ? index + 1 : index + 2 }} className={activeNav === path ? 'active' : ''} aria-current={activeNav === path ? 'page' : undefined} onClick={() => { if (path === 'flota') setStatus(''); if (path === 'movimientos') setDivision('Todos'); go(path) }}><Icon size={21} strokeWidth={activeNav === path ? 2.2 : 1.7} />{mobile}</button>)}
      <button type="button" className="nav-scanner" disabled={!data} onClick={() => setScanning(true)} aria-label="Escanear pasaporte VDL"><span><ScanLine size={26} /></span>Escanear</button>
    </nav>}
    {scanning && <Suspense fallback={<Modal title="Escáner VDL" close={() => setScanning(false)}><p className="muted">Cargando el escáner…</p></Modal>}>
      <Scanner close={() => setScanning(false)} onRead={raw => {
        const robot = data?.robots.find(item => item.serial_number === normalizeSerial(raw))
        if (!robot) return 'No se encontró ningún activo con este número de serie.'
        setScanning(false)
        go(`activo/${encodeURIComponent(robot.id)}`)
        return 'Activo encontrado.'
      }} />
    </Suspense>}
    {syncOpen && <Modal title="Conexión y sincronización" close={() => setSyncOpen(false)}>
      <div className="side-storage"><span className="storage-icon">{online ? <Wifi size={18} /> : <WifiOff size={18} />}</span>
        <span><strong>{online ? 'Dispositivo en línea' : 'Dispositivo sin conexión'}</strong><small>{pending} {pending === 1 ? 'movimiento pendiente' : 'movimientos pendientes'}</small></span></div>
      <p className="muted">{syncEndpoint ? 'Los movimientos pendientes se envían al reanudar la conexión.' : 'Los registros se guardan en IndexedDB. Configura el endpoint corporativo para sincronizar la cola.'}</p>
      {!!syncEndpoint && <button className="button primary" disabled={!online || !pending || syncBusy} onClick={async () => {
        setSyncBusy(true); setSyncMessage('')
        try { const count = await syncQueue(); await reload(); setSyncMessage(`${count} movimientos sincronizados.`) }
        catch (error) { setSyncMessage(error instanceof Error ? error.message : 'No se pudo sincronizar.') }
        finally { setSyncBusy(false) }
      }}><RefreshCw size={17} />{syncBusy ? 'Sincronizando…' : 'Sincronizar ahora'}</button>}
      {syncMessage && <p className="notice" role="status">{syncMessage}</p>}
      {install ? <button type="button" className="button secondary" onClick={async () => {
        try { await install.prompt() } finally { setInstall(null) }
      }}><Download size={17} />Instalar aplicación</button> : <p className="muted">Para instalarla, usa «Añadir a pantalla de inicio» en el menú del navegador.</p>}
    </Modal>}
    {profile && <Modal title="Perfil de supervisor" close={() => setProfile(false)}>
      <form className="form-stack" onSubmit={event => {
        event.preventDefault()
        const name = String(new FormData(event.currentTarget).get('supervisor') ?? '').trim()
        if (!name) return
        localStorage.setItem('vdl-supervisor', name)
        setSupervisorName(name)
        setProfile(false)
      }}>
        <div className="profile-summary"><span className="avatar">{initials}</span><div><strong>{supervisorName}</strong><span>Supervisor de operaciones</span></div></div>
        <label className="field"><span>Nombre para los registros</span><input name="supervisor" defaultValue={supervisorName} required maxLength={80} /></label>
        <button type="submit" className="button primary">Guardar perfil</button>
        <a className="button secondary" href={serviceDesk} target="_blank" rel="noreferrer"><Headphones size={18} />Soporte técnico Vanderlande</a>
      </form>
    </Modal>}
    {(toast || (update && !wizardActive)) && <div className="toast" role="status">
      {toast ? <><CheckCircle2 size={19} />{toast}<button className="icon-button" type="button" aria-label="Cerrar aviso" onClick={() => setToast('')}><X size={17} /></button></>
        : <><RefreshCw size={18} />Actualización disponible<button className="text-link" type="button" onClick={() => update?.()}>Actualizar</button></>}
    </div>}
  </div>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
