export const divisions = ['Almacenamiento', 'Paquetería', 'Aeropuertos'] as const
export type Division = typeof divisions[number]
export type DivisionFilter = Division | 'Todos'

export const statuses = ['En Hub Central', 'Desplegado en Nave', 'En Mantenimiento/Cuarentena'] as const
export type RobotStatus = typeof statuses[number]
export const statusLabel: Record<RobotStatus, string> = {
  'En Hub Central': 'En hub central',
  'Desplegado en Nave': 'Desplegado',
  'En Mantenimiento/Cuarentena': 'En cuarentena',
}

export const families = [
  'ADAPTO 3D Shuttle', 'STOREPICK Robot Cell', 'FASTPICK Goods-to-Person',
  'AIRPICK Pocket Sorter', 'HOMEPICK Module', 'BAGLOAD Robotic Arm (Gripper)',
  'DIRECTSORT Singulator', 'FLEET Autonomous Vehicle',
] as const
export type Family = typeof families[number]

export const movementLabels = {
  ENTRADA_HUB: 'Entrada al hub',
  SALIDA_A_PROYECTO: 'Salida a proyecto',
  RETORNO_MANTENIMIENTO: 'Retorno a mantenimiento',
} as const
export type MovementType = keyof typeof movementLabels

export interface Project {
  id: string
  name: string
  client: string
  division: Division
  solution_type: string
  location: string
  status: 'En Acopio' | 'En Montaje Mecánico' | 'Comisionado Software' | 'Activo'
}

export interface Robot {
  id: string
  serial_number: string
  name: string
  system_family: Family
  division: Division
  status: RobotStatus
  current_project_id: string | null
  firmware_version: string
  battery_health: number | null
  hours_used: number
  lift_cycles: number | null
  last_photo_url: string | null
  updated_at: string
}

export interface Material {
  sku: string
  description: string
  category: string
  quantity: number
  box_condition: 'Conforme' | 'Revisar' | 'Dañada'
}

export type Gps = { lat: number; lon: number }
export type PhotoKind = 'Material' | 'Albarán' | 'Incidencia'
export interface EvidencePhoto {
  id: string
  image: Blob
  kind: PhotoKind
  captured_at: string
  gps_coords: Gps | null
  note: string
  affected_robot_ids: string[]
}

export interface Movement {
  id: string
  type: MovementType
  project_id: string | null
  supervisor_name: string
  timestamp: string
  gps_coords: Gps | null
  robots_involved: string[]
  materials_detected: Material[]
  photos: EvidencePhoto[]
  carrier_signature: Blob | null
  sync_status: 'synced' | 'pending_offline'
  demo?: boolean
}

export interface Snapshot {
  robots: Robot[]
  projects: Project[]
  movements: Movement[]
}

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export const formatLongDate = () =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date())
export const formatNumber = (value: number) => value.toLocaleString('es-ES')
export const formatGps = (gps: Gps | null) => gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'GPS no disponible'
export const emptyMaterial = (): Material => ({ sku: '', description: '', category: '', quantity: 1, box_condition: 'Conforme' })

export function eligibleRobot(robot: Robot, type: MovementType, projectId: string | null) {
  if (type === 'SALIDA_A_PROYECTO') {
    return robot.status === statuses[0]
  }
  if (projectId && robot.current_project_id && projectId !== robot.current_project_id) return false
  return true
}

export function normalizeSerial(raw: string) {
  return raw.trim().toUpperCase()
}

export function newMovementId() {
  return `MOV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}
