import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getTierBySlug,
  getValores,
  updateTier,
  deleteTier,
  createValor,
  updateValor,
  deleteValor,
  uploadValorImagen,
  uploadTierImagen,
  uploadNivelImagen,
} from '../services/tiersApi.js'
import useAuthStore from '../store/useAuthStore.js'
import useMisTiersStore from '../store/useMisTiersStore.js'
import { iniciales } from '../utils/iniciales.js'
import { colorNivel } from '../components/TierRow.jsx'
import CropModal from '../components/CropModal.jsx'
import { puedeEditarTier, deadlinePasada } from '../utils/permisos.js'

export default function TierEditar() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const openLoginFn = useAuthStore((s) => s.openLogin)
  const tokens = useMisTiersStore((s) => s.tokens)

  const [tier, setTier] = useState(null)
  const [valores, setValores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [nombre, setNombre] = useState('')
  const [etiquetaValores, setEtiquetaValores] = useState('')
  const [anchoTitulo, setAnchoTitulo] = useState(110)
  const [fechaLimite, setFechaLimite] = useState('')
  const [modoApuesta, setModoApuesta] = useState(false)
  const [puntosPorNivel, setPuntosPorNivel] = useState({})

  const [nuevoValor, setNuevoValor] = useState('')
  const [nuevoNivel, setNuevoNivel] = useState('')
  const [pendingCrop, setPendingCrop] = useState(null)
  const [abiertoGeneral, setAbiertoGeneral] = useState(true)
  const [abiertoNiveles, setAbiertoNiveles] = useState(false)
  const [abiertoValores, setAbiertoValores] = useState(false)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    ;(async () => {
      try {
        const t = await getTierBySlug(slug)
        if (cancel) return
        setTier(t)
        setNombre(t.nombre)
        setEtiquetaValores(t.etiqueta_valores ?? '')
        setAnchoTitulo(t.ancho_titulo ?? 110)
        setFechaLimite(t.fecha_limite ? t.fecha_limite.slice(0, 10) : '')
        setModoApuesta(Boolean(t.modo_apuesta))
        setPuntosPorNivel(t.puntos_por_nivel ?? {})
        const v = await getValores(t.id)
        if (!cancel) setValores(v)
      } catch (e) {
        if (!cancel) setError(e.message)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [slug])

  if (loading) return <p>Cargando…</p>
  if (error) return <div className="alert alert-danger">{error}</div>
  if (!tier) return null

  if (!puedeEditarTier(tier, session, tokens)) {
    const esMio = Boolean(tokens[tier.id])
    const venció = deadlinePasada(tier)
    return (
      <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2">
        <span>
          {esMio && venció
            ? 'La fecha límite de este tier ya ha pasado — ya no puedes editarlo.'
            : 'No tienes permiso para editar este tier. Inicia sesión como admin o créalo desde este navegador.'}
        </span>
        {!session && (
          <button className="btn btn-sm btn-primary" onClick={openLoginFn}>
            Login admin
          </button>
        )}
      </div>
    )
  }

  async function guardarTier() {
    setError(null)
    setSaving(true)
    try {
      const patch = {
        nombre: nombre.trim(),
        etiqueta_valores: etiquetaValores.trim() || null,
        ancho_titulo: anchoTitulo,
        fecha_limite: fechaLimite ? new Date(fechaLimite).toISOString() : null,
        modo_apuesta: modoApuesta,
        puntos_por_nivel: modoApuesta ? puntosPorNivel : null,
      }
      await updateTier(tier.id, patch)
      setTier((prev) => ({ ...prev, ...patch }))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function borrarTier() {
    if (!confirm(`¿Borrar "${tier.nombre}" y todos sus valores y asignaciones?`)) return
    try {
      await deleteTier(tier.id)
      navigate('/')
    } catch (e) {
      setError(e.message)
    }
  }

  async function persistNiveles(nuevosNiveles) {
    try {
      await updateTier(tier.id, { niveles: nuevosNiveles })
      setTier((prev) => ({ ...prev, niveles: nuevosNiveles }))
    } catch (e) {
      setError(e.message)
    }
  }

  async function añadirNivel() {
    const v = nuevoNivel.trim()
    if (!v) return
    if (tier.niveles.some((n) => n.nombre === v)) {
      setError('Ya existe un nivel con ese nombre.')
      return
    }
    const nuevos = [...tier.niveles, { nombre: v, imagen_url: null }]
    setNuevoNivel('')
    await persistNiveles(nuevos)
  }

  async function renombrarNivel(idx, nuevoNombre) {
    const val = nuevoNombre.trim()
    if (!val) return
    if (tier.niveles.some((n, i) => i !== idx && n.nombre === val)) {
      setError('Ya existe un nivel con ese nombre.')
      return
    }
    const nuevos = tier.niveles.map((n, i) => (i === idx ? { ...n, nombre: val } : n))
    await persistNiveles(nuevos)
  }

  async function borrarNivel(idx) {
    if (!confirm('¿Borrar este nivel? Las asignaciones de los usuarios en este nivel se perderán.')) return
    const nuevos = tier.niveles.filter((_, i) => i !== idx)
    await persistNiveles(nuevos)
  }

  async function subirImagenNivel(idx, file) {
    try {
      const url = await uploadNivelImagen(tier.id, file)
      const nuevos = tier.niveles.map((n, i) => (i === idx ? { ...n, imagen_url: url } : n))
      await persistNiveles(nuevos)
    } catch (e) {
      setError(e.message)
    }
  }

  async function añadirValor() {
    const v = nuevoValor.trim()
    if (!v) return
    try {
      const creado = await createValor({ tier_id: tier.id, nombre: v, orden: valores.length })
      setValores((prev) => [...prev, creado])
      setNuevoValor('')
    } catch (e) {
      setError(e.message)
    }
  }

  async function renombrarValor(id, nuevoNombre) {
    try {
      await updateValor(tier.id, id, { nombre: nuevoNombre })
      setValores((prev) => prev.map((v) => (v.id === id ? { ...v, nombre: nuevoNombre } : v)))
    } catch (e) {
      setError(e.message)
    }
  }

  async function borrarValor(id) {
    if (!confirm('¿Borrar este valor? También se borrarán las asignaciones de los usuarios.')) return
    try {
      await deleteValor(tier.id, id)
      setValores((prev) => prev.filter((v) => v.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function subirImagen(id, file) {
    try {
      const url = await uploadValorImagen(tier.id, file)
      await updateValor(tier.id, id, { imagen_url: url })
      setValores((prev) => prev.map((v) => (v.id === id ? { ...v, imagen_url: url } : v)))
    } catch (e) {
      setError(e.message)
    }
  }

  async function setNivelCorrecto(id, nivel) {
    try {
      await updateValor(tier.id, id, { nivel_correcto: nivel })
      setValores((prev) => prev.map((v) => (v.id === id ? { ...v, nivel_correcto: nivel } : v)))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <h4 className="mb-2">Editar: {tier.nombre}</h4>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-sm btn-primary" onClick={guardarTier} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="btn btn-sm btn-outline-danger" onClick={borrarTier}>
            Borrar tier
          </button>
          <Link to={`/tiers/${tier.slug}`} className="btn btn-sm btn-outline-secondary">
            Volver al tier
          </Link>
        </div>
      </div>

      <section className="mb-4 p-3 border rounded">
        <h5
          className="m-0 d-flex align-items-center gap-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setAbiertoGeneral((v) => !v)}
        >
          <i className={`bi ${abiertoGeneral ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
          General
        </h5>
        {abiertoGeneral && (
        <div className="vstack gap-2 mt-3" style={{ maxWidth: 560 }}>
          <div className="d-flex align-items-center gap-3">
            <div className="tier-hero-thumb">
              {tier.imagen_url ? (
                <img src={tier.imagen_url} alt={tier.nombre} />
              ) : (
                <span className="text-muted small">sin imagen</span>
              )}
            </div>
            <label className="btn btn-outline-primary mb-0">
              {tier.imagen_url ? 'Cambiar imagen' : 'Subir imagen del tier'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  setPendingCrop({
                    file,
                    onAccept: async (cropped) => {
                      setPendingCrop(null)
                      try {
                        const url = await uploadTierImagen(tier.id, cropped)
                        await updateTier(tier.id, { imagen_url: url })
                        setTier((prev) => ({ ...prev, imagen_url: url }))
                      } catch (err) {
                        setError(err.message)
                      }
                    },
                  })
                }}
              />
            </label>
          </div>
          <div>
            <label className="form-label">Nombre</label>
            <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="form-label">¿Qué se va a clasificar?</label>
            <input
              className="form-control"
              value={etiquetaValores}
              onChange={(e) => setEtiquetaValores(e.target.value)}
              placeholder="p.ej. Series, Pizzas, Jugadores…"
            />
          </div>
          <div>
            <label className="form-label">Fecha límite</label>
            <input
              type="date"
              className="form-control"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
            />
          </div>
          <div className="form-check mt-2">
            <input
              id="modo-apuesta"
              type="checkbox"
              className="form-check-input"
              checked={modoApuesta}
              onChange={(e) => setModoApuesta(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="modo-apuesta">
              Modo apuesta
            </label>
          </div>
          {modoApuesta && (
            <div className="border rounded p-2">
              <div className="small text-muted mb-2">
                Puntos por acertar en cada nivel:
              </div>
              <div className="vstack gap-2">
                {tier.niveles.map((n) => (
                  <div key={n.nombre} className="d-flex align-items-center gap-2">
                    <span style={{ minWidth: 80 }}>{n.nombre}</span>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ maxWidth: 120 }}
                      value={puntosPorNivel[n.nombre] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? '' : Number(e.target.value)
                        setPuntosPorNivel((prev) => ({ ...prev, [n.nombre]: v }))
                      }}
                      placeholder="0"
                    />
                    <span className="text-muted small">puntos</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </section>

      <section className="mb-4 p-3 border rounded">
        <h5
          className="m-0 d-flex align-items-center gap-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setAbiertoNiveles((v) => !v)}
        >
          <i className={`bi ${abiertoNiveles ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
          Niveles ({tier.niveles.length})
        </h5>
        {abiertoNiveles && (
        <>
        <div className="d-flex gap-2 mb-3 mt-3">
          <input
            className="form-control"
            placeholder="Nuevo nivel…"
            value={nuevoNivel}
            onChange={(e) => setNuevoNivel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                añadirNivel()
              }
            }}
          />
          <button className="btn btn-success" onClick={añadirNivel}>
            Añadir
          </button>
        </div>
        <ul className="list-group">
          {tier.niveles.map((n, idx) => (
            <li key={`${idx}-${n.nombre}`} className="list-group-item d-flex align-items-center gap-2">
              <div className="valor-thumb">
                {n.imagen_url ? (
                  <img src={n.imagen_url} alt={n.nombre} />
                ) : (
                  <span className="iniciales">{iniciales(n.nombre)}</span>
                )}
              </div>
              <input
                className="form-control form-control-sm"
                defaultValue={n.nombre}
                onBlur={(e) => {
                  const val = e.target.value.trim()
                  if (val && val !== n.nombre) renombrarNivel(idx, val)
                }}
              />
              <label className="btn btn-sm btn-outline-primary mb-0">
                <i className="bi bi-image"></i>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setPendingCrop({
                      file,
                      onAccept: (cropped) => {
                        setPendingCrop(null)
                        subirImagenNivel(idx, cropped)
                      },
                    })
                  }}
                />
              </label>
              <button className="btn btn-sm btn-outline-danger" onClick={() => borrarNivel(idx)}>
                <i className="bi bi-trash"></i>
              </button>
            </li>
          ))}
        </ul>
        </>
        )}
      </section>

      <section className="mb-4 p-3 border rounded">
        <h5
          className="m-0 d-flex align-items-center gap-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setAbiertoValores((v) => !v)}
        >
          <i className={`bi ${abiertoValores ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
          Valores ({valores.length})
        </h5>
        {abiertoValores && (
        <>
        <div className="d-flex gap-2 mb-3 mt-3">
          <input
            className="form-control"
            placeholder="Nuevo valor…"
            value={nuevoValor}
            onChange={(e) => setNuevoValor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && añadirValor()}
          />
          <button className="btn btn-success" onClick={añadirValor}>
            Añadir
          </button>
        </div>
        <ul className="list-group">
          {valores.map((v) => (
            <li key={v.id} className="list-group-item d-flex align-items-center gap-2">
              <div className="valor-thumb">
                {v.imagen_url ? (
                  <img src={v.imagen_url} alt={v.nombre} />
                ) : (
                  <span className="iniciales">{iniciales(v.nombre)}</span>
                )}
              </div>
              <input
                className="form-control form-control-sm"
                defaultValue={v.nombre}
                onBlur={(e) => {
                  const val = e.target.value.trim()
                  if (val && val !== v.nombre) renombrarValor(v.id, val)
                }}
              />
              <label className="btn btn-sm btn-outline-primary mb-0">
                <i className="bi bi-image"></i>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setPendingCrop({
                      file,
                      onAccept: (cropped) => {
                        setPendingCrop(null)
                        subirImagen(v.id, cropped)
                      },
                    })
                  }}
                />
              </label>
              {modoApuesta && (
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: 140 }}
                  value={v.nivel_correcto ?? ''}
                  onChange={(e) => setNivelCorrecto(v.id, e.target.value || null)}
                  title="Nivel correcto (apuesta)"
                >
                  <option value="">— correcto —</option>
                  {tier.niveles.map((n) => (
                    <option key={n.nombre} value={n.nombre}>
                      {n.nombre}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn btn-sm btn-outline-danger" onClick={() => borrarValor(v.id)}>
                <i className="bi bi-trash"></i>
              </button>
            </li>
          ))}
        </ul>
        </>
        )}
      </section>

      <section className="mb-4 p-3 border rounded">
        <h5>Previsualizar</h5>
        <div style={{ maxWidth: 560 }}>
          <label className="form-label">Anchura títulos: {anchoTitulo}px</label>
          <input
            type="range"
            className="form-range"
            min="60"
            max="240"
            step="5"
            value={anchoTitulo}
            onChange={(e) => setAnchoTitulo(Number(e.target.value))}
          />
          <div className="tier-board mt-2">
            {tier.niveles.map((n, idx) => {
              const labelStyle = {
                background: colorNivel(idx, tier.niveles.length),
                flex: `0 0 ${anchoTitulo}px`,
                width: `${anchoTitulo}px`,
              }
              return (
                <div className="tier-row" key={`${idx}-${n.nombre}`}>
                  <div className="tier-row__label" style={labelStyle} title={n.nombre}>
                    {n.imagen_url ? (
                      <img src={n.imagen_url} alt={n.nombre} draggable={false} />
                    ) : (
                      <span className="tier-row__label-text">{n.nombre}</span>
                    )}
                  </div>
                  <div className="tier-row__drop" />
                </div>
              )
            })}
          </div>
        </div>
      </section>
      <CropModal
        file={pendingCrop?.file ?? null}
        onCancel={() => setPendingCrop(null)}
        onAccept={(f) => pendingCrop?.onAccept?.(f)}
      />
    </div>
  )
}
