import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { listTiers, getUsuariosCountPorTier } from '../services/tiersApi.js'
import useAuthStore from '../store/useAuthStore.js'
import useMisTiersStore from '../store/useMisTiersStore.js'

export default function Home() {
  const session = useAuthStore((s) => s.session)
  const tokens = useMisTiersStore((s) => s.tokens)
  const pruneMisTiers = useMisTiersStore((s) => s.pruneMisTiers)
  const [tiers, setTiers] = useState([])
  const [usuariosPorTier, setUsuariosPorTier] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancel = false
    Promise.all([listTiers(), getUsuariosCountPorTier()])
      .then(([data, counts]) => {
        if (cancel) return
        setTiers(data)
        setUsuariosPorTier(counts)
        pruneMisTiers(data.map((t) => t.id))
      })
      .catch((e) => !cancel && setError(e.message))
      .finally(() => !cancel && setLoading(false))
    return () => {
      cancel = true
    }
  }, [pruneMisTiers])

  const misTiers = useMemo(() => {
    const ids = new Set(Object.keys(tokens))
    return tiers.filter((t) => ids.has(t.id))
  }, [tiers, tokens])

  const renderLista = (items) => (
    <ul className="list-group">
      {items.map((t) => (
        <li key={t.id} className="list-group-item d-flex align-items-center gap-3">
          <div className="tier-list-thumb">
            {t.imagen_url && <img src={t.imagen_url} alt={t.nombre} />}
          </div>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <Link
              to={`/tiers/${t.slug}`}
              className="fw-bold text-decoration-none d-block text-break"
            >
              {t.nombre}
            </Link>
            <div className="small text-muted text-break">
              por {t.creador}
              {t.fecha_limite && ` · hasta ${format(new Date(t.fecha_limite), 'dd/MM/yyyy')}`}
            </div>
          </div>
          <div className="d-flex flex-column align-items-end gap-1">
            <span className="badge bg-secondary">{t.niveles.length} niveles</span>
            <span className="badge bg-info text-dark">
              {usuariosPorTier[t.id] ?? 0} usuarios
            </span>
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="m-0">Tiers</h2>
        {session && (
          <Link to="/tiers/nuevo" className="btn btn-success">
            <i className="bi bi-plus-lg"></i> Nuevo tier
          </Link>
        )}
      </div>
      {loading && <p>Cargando…</p>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && tiers.length === 0 && (
        <p className="text-muted">Todavía no hay tiers. Crea el primero.</p>
      )}
      {misTiers.length > 0 && (
        <div className="mb-4">
          <h5 className="mb-2">
            <i className="bi bi-bookmark-star"></i> Mis tiers
          </h5>
          {renderLista(misTiers)}
        </div>
      )}
      {tiers.length > 0 && (
        <div>
          {misTiers.length > 0 && <h5 className="mb-2">Todos los tiers</h5>}
          {renderLista(tiers)}
        </div>
      )}
      <p className="small text-muted mt-4 mb-0">
        <i className="bi bi-info-circle"></i> Guardamos algunas preferencias
        (nombre y tus tiers) en el almacenamiento local de tu navegador para
        recordarlos entre visitas. No usamos cookies de seguimiento.
      </p>
    </div>
  )
}
