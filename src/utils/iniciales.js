export function iniciales(nombre) {
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  return partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
}
