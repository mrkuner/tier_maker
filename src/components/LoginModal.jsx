import { useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { signIn } from '../services/authApi.js'
import useAuthStore from '../store/useAuthStore.js'

export default function LoginModal() {
  const isOpen = useAuthStore((s) => s.loginOpen)
  const close = useAuthStore((s) => s.closeLogin)
  const session = useAuthStore((s) => s.session)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setError(null)
      setSubmitting(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (session && isOpen) close()
  }, [session, isOpen, close])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal show={isOpen} onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title>Login admin</Modal.Title>
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
          <div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '…' : 'Entrar'}
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  )
}
