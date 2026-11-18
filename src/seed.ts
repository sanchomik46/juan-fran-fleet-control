import { families, statuses } from './domain'
import type { EvidencePhoto, Movement, Project, Robot, Snapshot } from './domain'
import { materialFromCatalog } from './catalog'
import { loadImage, stampPhoto, toBlob } from './media'

// Fixtures sintéticas creadas para la presentación de Arano.
// Las marcas y ciudades son referencias del brief del usuario. Los proyectos,
// movimientos, series, cantidades, telemetría y evidencias se generan como demo.
// Las coordenadas del histórico de ejemplo se dejan sin registrar.
const projects: Project[] = [
  { id: 'PRJ-001', name: 'Hub E-Commerce DHL Zaltbommel · Demo', client: 'DHL', division: 'Almacenamiento', solution_type: 'FASTPICK + ADAPTO', location: 'Zaltbommel, Países Bajos', status: 'Activo' },
  { id: 'PRJ-002', name: 'Centro de Distribución Mercadona · Demo', client: 'Mercadona', division: 'Almacenamiento', solution_type: 'STOREPICK End-to-End', location: 'Valencia, España', status: 'En Montaje Mecánico' },
  { id: 'PRJ-003', name: 'Hub Clasificación Paquetería DPD · Demo', client: 'DPD', division: 'Paquetería', solution_type: 'DIRECTSORT Parcel Hub', location: 'Madrid, España', status: 'Comisionado Software' },
  { id: 'PRJ-004', name: 'Terminal Aeroportuaria BHS · Demo', client: 'Terminal BHS', division: 'Aeropuertos', solution_type: 'BAGLOAD + FLEET', location: 'Barcelona, España', status: 'En Acopio' },
]

const dateAt = (daysAgo: number, hour: number, minute: number) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  if (daysAgo === 0 && date.getTime() > Date.now()) date.setDate(date.getDate() - 1)
  return date.toISOString()
}
const units = [
  ['ADP-089', 'Shuttle ADAPTO 089', 0, 0, null, 97, 618, 1222],
  ['ADP-072', 'Shuttle ADAPTO 072', 0, 1, 0, 94, 1584, 4862],
  ['ADP-091', 'Shuttle ADAPTO 091', 0, 0, null, 99, 83, 290],
  ['STP-014', 'Célula STOREPICK 014', 1, 1, 1, null, 780, 1352],
  ['STP-018', 'Célula STOREPICK 018', 1, 0, null, null, 230, 362],
  ['FSP-023', 'Estación FASTPICK 023', 2, 1, 0, null, 1494, null],
  ['ARP-031', 'Clasificador AIRPICK 031', 3, 0, null, null, 352, null],
  ['HMP-010', 'Módulo HOMEPICK 010', 4, 0, null, null, 124, null],
  ['BGL-006', 'Brazo BAGLOAD 006', 5, 2, null, null, 2430, 6538],
  ['DST-042', 'Singulador DIRECTSORT 042', 6, 1, 2, null, 710, null],
  ['FLT-027', 'Vehículo FLEET 027', 7, 1, 3, 91, 918, null],
  ['FLT-032', 'Vehículo FLEET 032', 7, 2, null, 73, 2140, null],
] as const

function makeDocument() {
  const canvas = document.createElement('canvas')
  canvas.width = 940
  canvas.height = 560
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f7f5ec'
  ctx.fillRect(0, 0, 940, 560)
  ctx.fillStyle = '#f48025'
  ctx.fillRect(0, 0, 940, 15)
  ctx.fillStyle = '#17191c'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText('VANDERLANDE', 52, 103)
  ctx.font = '26px monospace'
  ctx.fillText('ALBARAN DE DEMOSTRACION', 56, 161)
  ctx.fillRect(56, 204, 820, 2)
  ctx.font = 'bold 25px monospace'
  ctx.fillText('REFERENCIA              DESCRIPCION        UDS', 56, 252)
  ctx.font = '25px monospace'
  ctx.fillText('VDL-ADP-LIFT            ADAPTO LIFT          2', 56, 320)
  ctx.fillText('VDL-VSN-PLC             VISION PLC           4', 56, 382)
  ctx.fillText('VDL-DST-OPT             DIRECTSORT OPTICAL   8', 56, 444)
  return canvas
}

export async function demoDocument() {
  return toBlob(makeDocument(), 'image/png')
}

export async function seedData(): Promise<Snapshot> {
  const robots: Robot[] = units.map(([code, name, family, state, project, battery, hours, cycles]) => {
    const [prefix, number] = code.split('-')
    const serial = `VDL-${prefix}-2026-${number}`
    return {
      id: serial, serial_number: serial, name, system_family: families[family],
      division: family === 6 ? 'Paquetería' : family === 5 || family === 7 ? 'Aeropuertos' : 'Almacenamiento',
      status: statuses[state], current_project_id: project === null ? null : projects[project].id,
      firmware_version: `VISION-OS v4.${family % 3 + 6}.${family % 4}`,
      battery_health: battery, hours_used: hours, lift_cycles: cycles, last_photo_url: null, updated_at: dateAt(2, 12, 0),
    }
  })
  const examples = [
    { type: 'ENTRADA_HUB', project: null, supervisor: 'Arano', date: dateAt(0, 10, 42), units: [0, 2], materials: [[0, 2], [3, 4]], kind: 'Albarán' },
    { type: 'SALIDA_A_PROYECTO', project: 0, supervisor: 'Supervisor demo 01', date: dateAt(0, 8, 15), units: [1, 5], materials: [[1, 4]], kind: 'Material' },
    { type: 'RETORNO_MANTENIMIENTO', project: 3, supervisor: 'Arano', date: dateAt(1, 16, 30), units: [8, 11], materials: [[2, 1]], kind: 'Incidencia' },
    { type: 'SALIDA_A_PROYECTO', project: 2, supervisor: 'Supervisor demo 02', date: dateAt(1, 11, 20), units: [9], materials: [[4, 8]], kind: 'Material' },
    { type: 'SALIDA_A_PROYECTO', project: 1, supervisor: 'Supervisor demo 01', date: dateAt(2, 12, 0), units: [3], materials: [[6, 20]], kind: 'Material' },
    { type: 'SALIDA_A_PROYECTO', project: 3, supervisor: 'Supervisor demo 02', date: dateAt(3, 9, 15), units: [10], materials: [[5, 2]], kind: 'Material' },
  ] as const

  // The generated warehouse image is also used to compose the illustrative seed evidence.
  const warehouse = await loadImage(`${import.meta.env.BASE_URL}warehouse.webp`).catch(() => null)
  const gps = null
  const movements = await Promise.all(examples.map(async (example, index): Promise<Movement> => {
    const project = example.project === null ? null : projects[example.project]
    const id = `MOV-2026-0${164 - index}`
    const canvas = example.kind === 'Albarán' ? makeDocument() : document.createElement('canvas')
    const robotIds = example.units.map(unit => robots[unit].id)
    for (const unit of example.units) {
      robots[unit].last_photo_url = `#movimiento/${id}`
      robots[unit].updated_at = example.date
    }
    if (example.kind !== 'Albarán') {
      canvas.width = 960
      canvas.height = 540
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#262b33'
      ctx.fillRect(0, 0, 960, 540)
      if (warehouse) ctx.drawImage(warehouse, 325 + index * 52, 0, 950, 560, 0, 0, 960, 540)
      ctx.fillStyle = '#141619'
      ctx.fillRect(32, 32, 380, 54)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 23px sans-serif'
      ctx.fillText(`DEMO · ${robotIds[0]}`, 51, 66)
      if (example.kind === 'Incidencia') {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 9
        ctx.beginPath()
        ctx.ellipse(746, 356, 100, 61, 0.2, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    const photo: EvidencePhoto = {
      id: `${id}-photo`, image: await stampPhoto(canvas, { timestamp: example.date, projectId: project?.id ?? null, gps, supervisor: example.supervisor }),
      kind: example.kind, captured_at: example.date, gps_coords: gps,
      note: example.kind === 'Incidencia' ? 'Marca de demostración en el componente.' : '', affected_robot_ids: example.kind === 'Incidencia' ? robotIds : [],
    }
    return {
      id, type: example.type, project_id: project?.id ?? null, supervisor_name: example.supervisor,
      timestamp: example.date, gps_coords: gps, robots_involved: robotIds, materials_detected: example.materials.map(([part, count]) => materialFromCatalog(part, count)),
      photos: [photo], carrier_signature: null, sync_status: 'synced', demo: true,
    }
  }))
  return { projects, robots, movements }
}
