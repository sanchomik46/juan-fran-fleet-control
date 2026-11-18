export const defaultSupervisor = 'Arano'

export function isLegacySupervisor(name: string) {
  return ['juan fran', 'javier martín'].includes(name.trim().toLocaleLowerCase('es-ES'))
}

export function getSupervisorName() {
  const saved = localStorage.getItem('vdl-supervisor')?.trim()
  if (!saved || isLegacySupervisor(saved)) {
    localStorage.setItem('vdl-supervisor', defaultSupervisor)
    return defaultSupervisor
  }
  return saved
}
