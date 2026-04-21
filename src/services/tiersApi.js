import supabase, { supabaseForTier } from './supabaseClient.js'

const BUCKET = 'valores-img'
const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB

const TIER_COLUMNS = 'id, slug, nombre, niveles, fecha_limite, creador, imagen_url, etiqueta_valores, ancho_titulo, modo_apuesta, puntos_por_nivel, bloqueado, created_at'

export async function listTiers() {
  const { data, error } = await supabase
    .from('tiers')
    .select(TIER_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getTierBySlug(slug) {
  const { data, error } = await supabase
    .from('tiers')
    .select(TIER_COLUMNS)
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data
}

export async function getUsuariosCountPorTier() {
  const { data, error } = await supabase.from('asignaciones').select('tier_id, usuario')
  if (error) throw error
  const sets = new Map()
  for (const r of data) {
    if (!sets.has(r.tier_id)) sets.set(r.tier_id, new Set())
    sets.get(r.tier_id).add(r.usuario)
  }
  const out = {}
  for (const [tierId, set] of sets) out[tierId] = set.size
  return out
}

export async function createTier({ slug, nombre, niveles, fecha_limite, creador, imagen_url, etiqueta_valores, ancho_titulo, modo_apuesta, puntos_por_nivel, valores }) {
  const { data: tier, error: tErr } = await supabase
    .from('tiers')
    .insert({
      slug,
      nombre,
      niveles,
      fecha_limite,
      creador,
      imagen_url: imagen_url ?? null,
      etiqueta_valores: etiqueta_valores ?? null,
      ancho_titulo: ancho_titulo ?? null,
      modo_apuesta: modo_apuesta ?? false,
      puntos_por_nivel: puntos_por_nivel ?? null,
    })
    .select('id, slug, edit_token')
    .single()
  if (tErr) throw tErr

  let creados = []
  if (valores && valores.length > 0) {
    const rows = valores.map((v, idx) => ({
      tier_id: tier.id,
      nombre: v.nombre,
      imagen_url: v.imagen_url ?? null,
      orden: idx,
    }))
    const { data, error: vErr } = await supabase
      .from('valores')
      .insert(rows)
      .select('id, tier_id, nombre, imagen_url, orden, nivel_correcto')
      .order('orden', { ascending: true })
    if (vErr) throw vErr
    creados = data
  }
  return { tier, valores: creados }
}

export async function updateTier(id, patch) {
  const { error } = await supabaseForTier(id).from('tiers').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTier(id) {
  const { error } = await supabaseForTier(id).from('tiers').delete().eq('id', id)
  if (error) throw error
}

export async function getValores(tierId) {
  const { data, error } = await supabase
    .from('valores')
    .select('id, tier_id, nombre, imagen_url, orden, nivel_correcto')
    .eq('tier_id', tierId)
    .order('orden', { ascending: true })
  if (error) throw error
  return data
}

export async function createValor({ tier_id, nombre, imagen_url, orden }) {
  const { data, error } = await supabaseForTier(tier_id)
    .from('valores')
    .insert({ tier_id, nombre, imagen_url: imagen_url ?? null, orden: orden ?? 0 })
    .select('id, tier_id, nombre, imagen_url, orden, nivel_correcto')
    .single()
  if (error) throw error
  return data
}

export async function updateValor(tierId, id, patch) {
  const { error } = await supabaseForTier(tierId).from('valores').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteValor(tierId, id) {
  const { error } = await supabaseForTier(tierId).from('valores').delete().eq('id', id)
  if (error) throw error
}

export async function uploadValorImagen(tierId, file) {
  return uploadToBucket(`${tierId}/valores/${crypto.randomUUID()}`, file)
}

export async function uploadTierImagen(tierId, file) {
  return uploadToBucket(`${tierId}/tier/${crypto.randomUUID()}`, file)
}

export async function uploadNivelImagen(tierId, file) {
  return uploadToBucket(`${tierId}/niveles/${crypto.randomUUID()}`, file)
}

async function uploadToBucket(basePath, file) {
  if (!file) throw new Error('No hay archivo.')
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    throw new Error(`La imagen pesa ${mb} MB; el máximo permitido son 2 MB.`)
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${basePath}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function getAsignaciones(tierId, usuario) {
  let query = supabase
    .from('asignaciones')
    .select('id, tier_id, usuario, valor_id, nivel, orden')
    .eq('tier_id', tierId)
  if (usuario) query = query.eq('usuario', usuario)
  const { data, error } = await query.order('orden', { ascending: true })
  if (error) throw error
  return data
}

export async function upsertAsignacion({ tier_id, usuario, valor_id, nivel, orden }) {
  const { error } = await supabase
    .from('asignaciones')
    .upsert(
      { tier_id, usuario, valor_id, nivel, orden },
      { onConflict: 'tier_id,usuario,valor_id' },
    )
  if (error) throw error
}

export async function deleteAsignacion({ tier_id, usuario, valor_id }) {
  const { error } = await supabase
    .from('asignaciones')
    .delete()
    .match({ tier_id, usuario, valor_id })
  if (error) throw error
}

export async function deleteAllAsignaciones(tierId) {
  const { error } = await supabaseForTier(tierId)
    .from('asignaciones')
    .delete()
    .eq('tier_id', tierId)
  if (error) throw error
}

export async function clearCorreccion(tierId) {
  const { data: vals, error: fErr } = await supabase
    .from('valores')
    .select('id')
    .eq('tier_id', tierId)
  if (fErr) throw fErr
  if (!vals.length) return
  const { error } = await supabaseForTier(tierId)
    .from('valores')
    .update({ nivel_correcto: null })
    .eq('tier_id', tierId)
  if (error) throw error
}
