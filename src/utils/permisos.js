export function deadlinePasada(tier) {
  if (!tier?.fecha_limite) return false
  return new Date(tier.fecha_limite) < new Date()
}

export function tierBloqueado(tier) {
  if (!tier) return false
  return Boolean(tier.bloqueado) || deadlinePasada(tier)
}

export function puedeEditarTier(tier, session, tokens) {
  if (!tier) return false
  if (session) return true
  if (!tokens?.[tier.id]) return false
  return !deadlinePasada(tier)
}

export function puedeAsignar(tier, session) {
  if (!tier) return false
  if (session) return true
  return !tierBloqueado(tier)
}
