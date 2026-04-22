import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Modal } from 'react-bootstrap'
import { getTierBySlug, getValores, getAsignaciones } from '../services/tiersApi.js'
import { colorNivel } from '../components/TierRow.jsx'
import { iniciales } from '../utils/iniciales.js'
import usePrefsStore from '../store/usePrefsStore.js'

export default function TierEstadisticas() {
  const { slug } = useParams()
  const [tier, setTier] = useState(null)
  const [valores, setValores] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const modoTexto = usePrefsStore((s) => s.modoTexto)
  const toggleModoTexto = usePrefsStore((s) => s.toggleModoTexto)
  const [detalleValor, setDetalleValor] = useState(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    ;(async () => {
      try {
        const t = await getTierBySlug(slug)
        if (cancel) return
        setTier(t)
        const [v, a] = await Promise.all([getValores(t.id), getAsignaciones(t.id)])
        if (cancel) return
        setValores(v)
        setAsignaciones(a)
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

  const { porNivel, stats, usuarios } = useMemo(() => {
    if (!tier) return { porNivel: {}, stats: new Map(), usuarios: 0 }
    const nivelIndex = new Map(tier.niveles.map((n, i) => [n.nombre, i]))
    const out = {}
    for (const n of tier.niveles) out[n.nombre] = []
    const map = new Map()
    for (const a of asignaciones) {
      const idx = nivelIndex.get(a.nivel)
      if (idx === undefined) continue
      const entry = map.get(a.valor_id) ?? { suma: 0, votos: 0 }
      entry.suma += idx
      entry.votos += 1
      map.set(a.valor_id, entry)
    }
    const valorById = new Map(valores.map((v) => [v.id, v]))
    const computed = []
    for (const [valor_id, { suma, votos }] of map.entries()) {
      const v = valorById.get(valor_id)
      if (!v) continue
      const mean = suma / votos
      const target = Math.min(
        tier.niveles.length - 1,
        Math.max(0, Math.round(mean)),
      )
      computed.push({ valor: v, mean, votos, nivelIdx: target })
    }
    computed.sort((a, b) => {
      if (a.nivelIdx !== b.nivelIdx) return a.nivelIdx - b.nivelIdx
      if (a.mean !== b.mean) return a.mean - b.mean
      return b.votos - a.votos
    })
    for (const c of computed) {
      const nombre = tier.niveles[c.nivelIdx].nombre
      out[nombre].push(c)
    }
    const usuariosUnicos = new Set(asignaciones.map((a) => a.ranking_id)).size
    return { porNivel: out, stats: map, usuarios: usuariosUnicos }
  }, [tier, valores, asignaciones])

  if (loading) return <p>Cargando…</p>
  if (error) return <div className="alert alert-danger">{error}</div>
  if (!tier) return null

  const sinVotos = valores.filter((v) => !stats.has(v.id))

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link to={`/tiers/${tier.slug}`} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left"></i> Volver al tier
        </Link>
        <span className="badge bg-info text-dark align-self-center">
          {usuarios} usuario{usuarios === 1 ? '' : 's'} · {asignaciones.length} votos
        </span>
      </div>
      <div className="tier-cabecera d-flex align-items-center gap-3 mb-3">
        {tier.imagen_url && (
          <div className="tier-hero-thumb">
            <img src={tier.imagen_url} alt={tier.nombre} />
          </div>
        )}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <h2 className="m-0 text-break">Estadísticas: {tier.nombre}</h2>
          <div className="small text-muted">Ranking medio por valor</div>
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 mb-2 flex-nowrap">
        <button
          type="button"
          className="btn btn-outline-secondary py-0 px-2"
          style={{ fontSize: '0.75rem' }}
          onClick={toggleModoTexto}
          title={modoTexto ? 'Mostrar como imágenes' : 'Mostrar como texto'}
        >
          <i className={`bi ${modoTexto ? 'bi-image' : 'bi-fonts'}`}></i>{' '}
          {modoTexto ? 'Ver imágenes' : 'Ver texto'}
        </button>
      </div>

      <div className="tier-board">
        <div className="tier-board__header">
          <div className="tier-board__title">{tier.nombre}</div>
          <div className="tier-board__user">resumen · {usuarios} votantes</div>
        </div>
        {tier.niveles.map((nivel, idx) => {
          const color = colorNivel(idx, tier.niveles.length)
          const ancho = tier.ancho_titulo ?? 110
          const labelStyle = {
            background: color,
            flex: `0 0 ${ancho}px`,
            width: `${ancho}px`,
          }
          const items = porNivel[nivel.nombre] ?? []
          return (
            <div className="tier-row" key={nivel.nombre}>
              <div className="tier-row__label" style={labelStyle} title={nivel.nombre}>
                {nivel.imagen_url ? (
                  <img src={nivel.imagen_url} alt={nivel.nombre} draggable={false} />
                ) : (
                  <span className="tier-row__label-text">{nivel.nombre}</span>
                )}
              </div>
              <div className="tier-row__drop">
                {items.map(({ valor, votos, mean }) => (
                  <div
                    key={valor.id}
                    className="valor-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetalleValor(valor)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetalleValor(valor)
                      }
                    }}
                    title={`${valor.nombre} · ${votos} voto${votos === 1 ? '' : 's'} · media ${mean.toFixed(2)}`}
                  >
                    {modoTexto ? (
                      <span className="iniciales">{valor.nombre}</span>
                    ) : valor.imagen_url ? (
                      <img src={valor.imagen_url} alt={valor.nombre} draggable={false} />
                    ) : (
                      <span className="iniciales">{iniciales(valor.nombre)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {sinVotos.length > 0 && (
        <div className="mt-3">
          <h6 className="text-muted">Sin votos</h6>
          <div className="tier-unassigned">
            {sinVotos.map((v) => (
              <div
                key={v.id}
                className="valor-card"
                role="button"
                tabIndex={0}
                onClick={() => setDetalleValor(v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setDetalleValor(v)
                  }
                }}
                title={v.nombre}
              >
                {modoTexto ? (
                  <span className="iniciales">{v.nombre}</span>
                ) : v.imagen_url ? (
                  <img src={v.imagen_url} alt={v.nombre} draggable={false} />
                ) : (
                  <span className="iniciales">{iniciales(v.nombre)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <h6>Ranking detallado</h6>
        <ol className="list-group list-group-numbered">
          {Object.values(porNivel)
            .flat()
            .sort((a, b) => a.mean - b.mean)
            .map(({ valor, mean, votos, nivelIdx }) => (
              <li key={valor.id} className="list-group-item d-flex align-items-center gap-2">
                <div className="valor-thumb">
                  {valor.imagen_url ? (
                    <img src={valor.imagen_url} alt={valor.nombre} />
                  ) : (
                    <span className="iniciales">{iniciales(valor.nombre)}</span>
                  )}
                </div>
                <div className="flex-grow-1">
                  <div className="fw-bold">{valor.nombre}</div>
                  <div className="small text-muted">
                    media {mean.toFixed(2)} · tier {tier.niveles[nivelIdx].nombre} · {votos} voto{votos === 1 ? '' : 's'}
                  </div>
                </div>
              </li>
            ))}
        </ol>
      </div>

      <Modal show={!!detalleValor} onHide={() => setDetalleValor(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{detalleValor?.nombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {detalleValor?.imagen_url ? (
            <img
              src={detalleValor.imagen_url}
              alt={detalleValor.nombre}
              style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
            />
          ) : (
            <div className="text-muted">Sin imagen</div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}
