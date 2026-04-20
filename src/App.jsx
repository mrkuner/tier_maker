import { useEffect } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import TierNuevo from './pages/TierNuevo.jsx'
import TierView from './pages/TierView.jsx'
import TierEditar from './pages/TierEditar.jsx'
import TierEstadisticas from './pages/TierEstadisticas.jsx'
import TierApuestas from './pages/TierApuestas.jsx'
import TierCorregir from './pages/TierCorregir.jsx'
import LoginModal from './components/LoginModal.jsx'
import supabase from './services/supabaseClient.js'
import { signOut } from './services/authApi.js'
import useAuthStore from './store/useAuthStore.js'

export default function App() {
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)
  const openLogin = useAuthStore((s) => s.openLogin)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [setSession])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="container py-3">
      <nav className="mb-3 d-flex align-items-center gap-3">
        <Link to="/" className="text-decoration-none">
          <span className="logo-dna">
            <img src="/logo.png" alt="TierLab" style={{ height: 48 }} />
          </span>
        </Link>
        <div className="ms-auto d-flex align-items-center gap-2">
          {session ? (
            <>
              <span className="small text-muted">admin: {session.user.email}</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={handleSignOut}>
                Salir
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-outline-primary" onClick={openLogin}>
              Admin
            </button>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tiers/nuevo" element={<TierNuevo />} />
        <Route path="/tiers/:slug" element={<TierView />} />
        <Route path="/tiers/:slug/editar" element={<TierEditar />} />
        <Route path="/tiers/:slug/estadisticas" element={<TierEstadisticas />} />
        <Route path="/tiers/:slug/apuestas" element={<TierApuestas />} />
        <Route path="/tiers/:slug/corregir" element={<TierCorregir />} />
      </Routes>
      <LoginModal />
    </div>
  )
}
