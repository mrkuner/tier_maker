import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTierBySlug, getValores, getAsignaciones } from '../services/tiersApi.js'
import { colorNivel } from '../components/TierRow.jsx'
import { iniciales } from '../utils/iniciales.js'

export default function TierApuestas() {
  const { slug } = useParams()
  const [tier, setTier] = useState(null)
  const [valores, setValores] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  const ranking = useMemo(() => {
    if (!tier) return []
    const puntosMap = tier.puntos_por_nivel ?? {}
    const valorById = new Map(valores.map((v) => [v.id, v]))
    const porUsuario = new Map()
    for (const a of asignaciones) {
      const v = valorById.get(a.valor_id)
      if (!v) continue
      const entry = porUsuario.get(a.usuario) ?? { puntos: 0, aciertos: 0, votos: 0 }
      entry.votos += 1
      if (v.nivel_correcto && v.nivel_correcto === a.nivel) {
        const puntos = Number(puntosMap[a.nivel]) || 0
        entry.puntos += puntos
        entry.aciertos += 1
      }
      porUsuario.set(a.usuario, entry)
    }
    return [...porUsuario.entries()]
      .map(([usuario, s]) => ({ usuario, ...s }))
      .sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos
        if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos
        return a.usuario.localeCompare(b.usuario)
      })
  }, [tier, valores, asignaciones])

  const valoresCorregidos = useMemo(
    () => valores.filter((v) => v.nivel_correcto),
    [valores],
  )
  const tierFinalizado = valores.length > 0 && valoresCorregidos.length === valores.length
  const [openPuntos, setOpenPuntos] = useState(true)
  const [openCorregidos, setOpenCorregidos] = useState(true)
  useEffect(() => {
    if (tierFinalizado) {
      setOpenPuntos(false)
      setOpenCorregidos(false)
    }
  }, [tierFinalizado])

  if (loading) return <p>Cargando…</p>
  if (error) return <div className="alert alert-danger">{error}</div>
  if (!tier) return null
  if (!tier.modo_apuesta) {
    return (
      <div>
        <Link to={`/tiers/${tier.slug}`} className="btn btn-sm btn-outline-secondary mb-3">
          <i className="bi bi-arrow-left"></i> Volver al tier
        </Link>
        <div className="alert alert-warning">Este tier no tiene modo apuesta activado.</div>
      </div>
    )
  }

  const puntosMap = tier.puntos_por_nivel ?? {}

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link to={`/tiers/${tier.slug}`} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left"></i> Volver al tier
        </Link>
        <Link to={`/tiers/${tier.slug}/estadisticas`} className="btn btn-sm btn-outline-dark">
          <i className="bi bi-bar-chart"></i> Estadísticas
        </Link>
        <span className="badge bg-info text-dark align-self-center">
          {ranking.length} participante{ranking.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="tier-cabecera d-flex align-items-center gap-3 mb-3">
        {tier.imagen_url && (
          <div className="tier-hero-thumb">
            <img src={tier.imagen_url} alt={tier.nombre} />
          </div>
        )}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <h4 className="m-0 text-break">Puntuaciones: {tier.nombre}</h4>
          <div className="small text-muted">Ranking por aciertos</div>
        </div>
      </div>

      {(() => {
        const rankingPanel = (
          <div className="mb-4" key="ranking">
            <h6>Ranking</h6>
            {valoresCorregidos.length === 0 ? (
              <div className="text-muted">
                {ranking.length} clasificaci{ranking.length === 1 ? 'ón' : 'ones'} enviada
                {ranking.length === 1 ? '' : 's'} hasta ahora.
              </div>
            ) : ranking.length === 0 ? (
              <div className="text-muted">Todavía no hay votos.</div>
            ) : (
              <ol className="list-group list-group-numbered">
                {ranking.map((r) => (
                  <li
                    key={r.usuario}
                    className="list-group-item d-flex align-items-center gap-2"
                  >
                    <div className="flex-grow-1">
                      <div className="fw-bold">{r.usuario}</div>
                      <div className="small text-muted">
                        {r.aciertos} acierto{r.aciertos === 1 ? '' : 's'} de {r.votos} voto
                        {r.votos === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="badge bg-success fs-6">{r.puntos} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
        const puntosPanel = (
          <div className="mb-4" key="puntos">
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-decoration-none"
              onClick={() => setOpenPuntos((v) => !v)}
            >
              <i className={`bi ${openPuntos ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>{' '}
              <span className="fw-bold">Puntos por nivel</span>
            </button>
            {openPuntos && (
              <ul className="list-group mt-2" style={{ maxWidth: 320 }}>
                {tier.niveles.map((n, idx) => (
                  <li
                    key={n.nombre}
                    className="list-group-item d-flex align-items-center gap-2 py-1"
                  >
                    <span
                      className="d-inline-block rounded"
                      style={{
                        background: colorNivel(idx, tier.niveles.length),
                        width: 18,
                        height: 18,
                        flexShrink: 0,
                      }}
                    />
                    <span className="flex-grow-1 text-truncate fw-semibold">{n.nombre}</span>
                    <span className="badge bg-secondary">
                      {Number(puntosMap[n.nombre]) || 0} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
        const corregidosPanel = (
          <div className="mb-4" key="corregidos">
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-decoration-none"
              onClick={() => setOpenCorregidos((v) => !v)}
            >
              <i className={`bi ${openCorregidos ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>{' '}
              <span className="fw-bold">Valores corregidos</span>
            </button>
            {openCorregidos && (
              <div className="mt-2">
                {valoresCorregidos.length === 0 ? (
                  <div className="text-muted">
                    El administrador todavía no ha marcado ningún nivel correcto.
                  </div>
                ) : (
                  <ul className="list-group">
                    {valoresCorregidos.map((v) => {
                      const idx = tier.niveles.findIndex((n) => n.nombre === v.nivel_correcto)
                      const color =
                        idx >= 0 ? colorNivel(idx, tier.niveles.length) : '#eee'
                      return (
                        <li
                          key={v.id}
                          className="list-group-item d-flex align-items-center gap-2"
                        >
                          <div className="valor-thumb">
                            {v.imagen_url ? (
                              <img src={v.imagen_url} alt={v.nombre} />
                            ) : (
                              <span className="iniciales">{iniciales(v.nombre)}</span>
                            )}
                          </div>
                          <div className="flex-grow-1 fw-bold">{v.nombre}</div>
                          <span
                            className="badge"
                            style={{ background: color, color: '#222' }}
                          >
                            {v.nivel_correcto}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )
        return tierFinalizado
          ? [rankingPanel, puntosPanel, corregidosPanel]
          : [puntosPanel, corregidosPanel, rankingPanel]
      })()}
    </div>
  )
}
