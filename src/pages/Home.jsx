import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { listTiers, getUsuariosCountPorTier } from '../services/tiersApi.js'
import useAuthStore from '../store/useAuthStore.js'

export default function Home() {
  const session = useAuthStore((s) => s.session)
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
      })
      .catch((e) => !cancel && setError(e.message))
      .finally(() => !cancel && setLoading(false))
    return () => {
      cancel = true
    }
  }, [])

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
      <ul className="list-group">
        {tiers.map((t) => (
          <li key={t.id} className="list-group-item d-flex align-items-center gap-3">
            <div className="tier-list-thumb">
              {t.imagen_url && <img src={t.imagen_url} alt={t.nombre} />}
            </div>
            <div className="flex-grow-1">
              <Link to={`/tiers/${t.slug}`} className="fw-bold text-decoration-none">
                {t.nombre}
              </Link>
              <div className="small text-muted">
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
    </div>
  )
}
