export const defaultSupervisor = 'Juan Fran'

export function getSupervisorName() {
  const saved = localStorage.getItem('vdl-supervisor')?.trim()
  if (!saved || saved === 'Javier Martín') return defaultSupervisor
  return saved
}
