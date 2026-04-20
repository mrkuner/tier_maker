import { useEffect, useState } from 'react'
import useUserStore from '../store/useUserStore.js'

export default function NombreUsuarioInput({ className = 'd-flex gap-2 align-items-center mb-3' }) {
  const nombre = useUserStore((s) => s.nombre)
  const setNombre = useUserStore((s) => s.setNombre)
  const [draft, setDraft] = useState(nombre)

  useEffect(() => {
    setDraft(nombre)
  }, [nombre])

  function persistir() {
    const v = draft.trim()
    if (v !== nombre) setNombre(v)
  }

  return (
    <div className={className}>
      <label className="form-label m-0">Nombre:</label>
      <input
        type="text"
        className="form-control form-control-sm"
        style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 180 }}
        value={draft}
        placeholder="p.ej. Félix"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={persistir}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            persistir()
            e.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}
