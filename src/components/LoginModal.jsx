import { useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { signIn, signUp } from '../services/authApi.js'
import useAuthStore from '../store/useAuthStore.js'

export default function LoginModal() {
  const isOpen = useAuthStore((s) => s.loginOpen)
  const close = useAuthStore((s) => s.closeLogin)
  const session = useAuthStore((s) => s.session)

  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setError(null)
      setInfo(null)
      setSubmitting(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (session && isOpen) close()
  }, [session, isOpen, close])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        const { session: s, user } = await signUp(email, password)
        if (!s) {
          setInfo(
            `Usuario creado (${user?.email}). Confirma el email y luego inicia sesión.`,
          )
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal show={isOpen} onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title>{mode === 'signin' ? 'Login admin' : 'Crear admin'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <form onSubmit={handleSubmit} className="vstack gap-3">
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <div className="alert alert-danger m-0">{error}</div>}
          {info && <div className="alert alert-info m-0">{info}</div>}
          <div className="d-flex align-items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
            </button>
            <button
              type="button"
              className="btn btn-link p-0 ms-auto"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? '¿Primera vez? Crear admin' : 'Ya tengo cuenta'}
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  )
}
