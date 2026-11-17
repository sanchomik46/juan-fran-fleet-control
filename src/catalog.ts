import type { Material } from './domain'

const item = (sku: string, description: string, category: string, aliases: string[]) =>
  ({ sku, description, category, aliases })

export const catalog = [
  item('VDL-ADP-LIFT', 'Módulo elevador ADAPTO', 'Elevación', ['ADAPTO LIFT', 'ELEVADOR ADAPTO']),
  item('VDL-ADP-LOAD', 'Celda de carga ADAPTO', 'Sensores', ['ADAPTO LOAD CELL', 'CELDA DE CARGA ADAPTO']),
  item('VDL-BGL-GRP', 'Gripper neumático BAGLOAD', 'Robótica', ['BAGLOAD GRIPPER', 'GRIPPER BAGLOAD', 'GARRA BAGLOAD']),
  item('VDL-VSN-PLC', 'Controlador PLC VISION', 'Control', ['VISION PLC', 'PLC VISION']),
  item('VDL-DST-OPT', 'Sensor óptico DIRECTSORT', 'Sensores', ['DIRECTSORT OPTICAL', 'SENSOR OPTICO DIRECTSORT']),
  item('VDL-FLT-LID', 'Sensor LiDAR FLEET', 'Sensores', ['FLEET LIDAR', 'LIDAR FLEET']),
  item('VDL-STP-RACK', 'Perfil de rack STOREPICK', 'Estructura', ['STOREPICK RACK', 'RACK STOREPICK']),
  item('VDL-ARP-TRY', 'Bandeja AIRPICK', 'Transporte', ['AIRPICK TRAY', 'BANDEJA AIRPICK']),
]

export function materialFromCatalog(index: number, quantity: number): Material {
  const { sku, description, category } = catalog[index]
  return { sku, description, category, quantity, box_condition: 'Conforme' }
}
