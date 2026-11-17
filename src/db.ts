import { openDB } from 'idb'
import type { DBSchema } from 'idb'
import { eligibleRobot, statuses } from './domain'
import type { Movement, Project, Robot, Snapshot } from './domain'

interface FleetDB extends DBSchema {
  projects: { key: string; value: Project }
  robots: { key: string; value: Robot }
  movements: { key: string; value: Movement }
  outbox: { key: string; value: { id: string; queued_at: string; robots?: Robot[] } }
}

const basePath = import.meta.env.BASE_URL
const databaseName = basePath === '/' ? 'vanderlande-fleet' : `vanderlande-fleet:${basePath}`
let dbPromise: ReturnType<typeof connect> | undefined
const connect = () => openDB<FleetDB>(databaseName, 1, {
  upgrade(database) {
    for (const name of ['projects', 'robots', 'movements', 'outbox'] as const) {
      database.createObjectStore(name, { keyPath: 'id' })
    }
  },
})
const db = () => dbPromise ??= connect()
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(databaseName) : null
export function onDatabaseChange(listener: () => void) {
  channel?.addEventListener('message', listener)
  return () => channel?.removeEventListener('message', listener)
}

export async function snapshot(): Promise<Snapshot> {
  const connection = await db()
  if (!(await connection.count('projects'))) {
    const data = await (await import('./seed')).seedData()
    const seed = connection.transaction(['projects', 'robots', 'movements'], 'readwrite')
    if (!(await seed.objectStore('projects').count())) {
      await Promise.all([
        ...data.projects.map(project => seed.objectStore('projects').put(project)),
        ...data.robots.map(robot => seed.objectStore('robots').put(robot)),
        ...data.movements.map(movement => seed.objectStore('movements').put(movement)),
      ])
    }
    await seed.done
  }
  const read = connection.transaction(['robots', 'projects', 'movements'])
  const [robots, projects, movements] = await Promise.all([
    read.objectStore('robots').getAll(), read.objectStore('projects').getAll(), read.objectStore('movements').getAll(),
  ])
  await read.done
  movements.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return { robots, projects, movements }
}

export async function registerMovement(movement: Movement, newRobots: Robot[] = []) {
  const connection = await db()
  const tx = connection.transaction(['projects', 'robots', 'movements', 'outbox'], 'readwrite')
  const robotStore = tx.objectStore('robots')
  const movementStore = tx.objectStore('movements')
  let robots: Robot[]
  try {
    if (await movementStore.getKey(movement.id)) throw new Error('Este movimiento ya está registrado.')
    if (movement.project_id && !await tx.objectStore('projects').getKey(movement.project_id)) throw new Error('El proyecto ya no está disponible.')
    const incoming = new Map(newRobots.map(robot => [robot.id, robot]))
    const selected = await Promise.all(movement.robots_involved.map(async id => {
      const stored = await robotStore.get(id)
      if (stored && incoming.has(id)) throw new Error(`La serie ${id} ya se ha dado de alta. Selecciónala en el inventario.`)
      return stored ?? (movement.type === 'ENTRADA_HUB' ? incoming.get(id) : undefined)
    }))
    if (!selected.every((robot): robot is Robot => Boolean(robot && eligibleRobot(robot, movement.type, movement.project_id)))) {
      throw new Error('La disponibilidad de un activo ha cambiado. Revisa la selección.')
    }
    robots = selected.map(robot => {
      const damaged = movement.photos.some(photo => photo.affected_robot_ids.includes(robot.id))
      const status = damaged || movement.type === 'RETORNO_MANTENIMIENTO' ? statuses[2]
        : movement.type === 'SALIDA_A_PROYECTO' ? statuses[1] : statuses[0]
      return {
        ...robot, status,
        current_project_id: status === statuses[1] ? movement.project_id : null,
        last_photo_url: movement.photos.length ? `#movimiento/${movement.id}` : robot.last_photo_url,
        updated_at: movement.timestamp,
      }
    })
    await Promise.all([
      ...robots.map(robot => robotStore.put(robot)),
      movementStore.add(movement),
      tx.objectStore('outbox').add({ id: movement.id, queued_at: movement.timestamp, robots }),
      tx.done,
    ])
  } catch (error) {
    try { tx.abort() } catch { /* The transaction may have already aborted. */ }
    await tx.done.catch(() => undefined)
    throw error
  }
  channel?.postMessage('refresh')
}

export const syncEndpoint = import.meta.env.VITE_SYNC_ENDPOINT?.trim()

export function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer la evidencia adjunta.'))
    reader.readAsDataURL(blob)
  })
}

async function uploadQueue() {
  if (!syncEndpoint) throw new Error('Configura el endpoint corporativo para enviar la cola.')
  if (!navigator.onLine) throw new Error('El dispositivo está sin conexión.')
  const connection = await db()
  const pending = (await connection.getAll('outbox')).sort((a, b) => a.queued_at.localeCompare(b.queued_at))
  for (const entry of pending) {
    const movement = await connection.get('movements', entry.id)
    if (!movement) throw new Error(`Movimiento local no encontrado: ${entry.id}`)
    const response = await fetch(syncEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': movement.id },
      body: JSON.stringify({
        ...movement,
        robots: entry.robots ?? [],
        photos: await Promise.all(movement.photos.map(async photo => ({ ...photo, image: await asDataUrl(photo.image) }))),
        carrier_signature: movement.carrier_signature ? await asDataUrl(movement.carrier_signature) : null,
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) throw new Error(`El servidor rechazó el movimiento (${response.status}).`)
    const tx = connection.transaction(['outbox', 'movements'], 'readwrite')
    await Promise.all([
      tx.objectStore('movements').put({ ...movement, sync_status: 'synced' }),
      tx.objectStore('outbox').delete(entry.id),
      tx.done,
    ])
    channel?.postMessage('refresh')
  }
  return pending.length
}

let syncing: Promise<number> | undefined
export function syncQueue() {
  if (!syncing) {
    const run = async () => navigator.locks ? await navigator.locks.request(`${databaseName}:sync`, uploadQueue) : uploadQueue()
    syncing = run().finally(() => { syncing = undefined })
  }
  return syncing
}
