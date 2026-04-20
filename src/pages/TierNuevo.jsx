import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createTier,
  updateTier,
  updateValor,
  uploadTierImagen,
  uploadValorImagen,
  uploadNivelImagen,
} from '../services/tiersApi.js'
import { slugify } from '../utils/slug.js'
import { iniciales } from '../utils/iniciales.js'
import { colorNivel } from '../components/TierRow.jsx'
import CropModal from '../components/CropModal.jsx'
import useUserStore from '../store/useUserStore.js'
import useAuthStore from '../store/useAuthStore.js'

const NIVELES_DEFAULT = ['S', 'A', 'B', 'C', 'D']

export default function TierNuevo() {
  const navigate = useNavigate()
  const nombreUsuario = useUserStore((s) => s.nombre)
  const setNombreUsuario = useUserStore((s) => s.setNombre)
  const session = useAuthStore((s) => s.session)
  const openLogin = useAuthStore((s) => s.openLogin)

  const [step, setStep] = useState('form')
  const [nombre, setNombre] = useState('')
  const [etiquetaValores, setEtiquetaValores] = useState('')
  const [anchoTitulo, setAnchoTitulo] = useState(110)
  const [niveles, setNiveles] = useState(() =>
    NIVELES_DEFAULT.map((n) => ({ id: crypto.randomUUID(), nombre: n, file: null, previewUrl: null })),
  )
  const [nuevoNivel, setNuevoNivel] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [creador, setCreador] = useState(nombreUsuario)
  const [imagenFile, setImagenFile] = useState(null)
  const [items, setItems] = useState([])
  const [nuevoValor, setNuevoValor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [pendingCrop, setPendingCrop] = useState(null)

  const previewsRef = useRef(new Set())

  useEffect(() => {
    return () => {
      for (const url of previewsRef.current) URL.revokeObjectURL(url)
      previewsRef.current.clear()
    }
  }, [])

  if (!session) {
    return (
      <div className="alert alert-warning d-flex align-items-center gap-2">
        <span>Debes iniciar sesión como admin para crear tiers.</span>
        <button className="btn btn-sm btn-primary" onClick={openLogin}>
          Login
        </button>
      </div>
    )
  }

  function setPreview(prevUrl, file) {
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl)
      previewsRef.current.delete(prevUrl)
    }
    const url = URL.createObjectURL(file)
    previewsRef.current.add(url)
    return url
  }

  // --- Valores ---
  function añadirValor() {
    const v = nuevoValor.trim()
    if (!v) return
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nombre: v, file: null, previewUrl: null },
    ])
    setNuevoValor('')
  }
  const renombrarValor = (id, n) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, nombre: n } : it)))
  const eliminarValor = (id) =>
    setItems((prev) => {
      const q = prev.find((it) => it.id === id)
      if (q?.previewUrl) {
        URL.revokeObjectURL(q.previewUrl)
        previewsRef.current.delete(q.previewUrl)
      }
      return prev.filter((it) => it.id !== id)
    })
  const asignarImagenValor = (id, file) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, file, previewUrl: setPreview(it.previewUrl, file) } : it,
      ),
    )

  // --- Niveles ---
  function añadirNivel() {
    const v = nuevoNivel.trim()
    if (!v) return
    setNiveles((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nombre: v, file: null, previewUrl: null },
    ])
    setNuevoNivel('')
  }
  const renombrarNivel = (id, n) =>
    setNiveles((prev) => prev.map((it) => (it.id === id ? { ...it, nombre: n } : it)))
  const eliminarNivel = (id) =>
    setNiveles((prev) => {
      const q = prev.find((it) => it.id === id)
      if (q?.previewUrl) {
        URL.revokeObjectURL(q.previewUrl)
        previewsRef.current.delete(q.previewUrl)
      }
      return prev.filter((it) => it.id !== id)
    })
  const asignarImagenNivel = (id, file) =>
    setNiveles((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, file, previewUrl: setPreview(it.previewUrl, file) } : it,
      ),
    )

  function irAPreview(e) {
    e.preventDefault()
    setError(null)
    const nivelesValidos = niveles.filter((n) => n.nombre.trim().length > 0)
    const valoresValidos = items.filter((it) => it.nombre.trim().length > 0)
    if (
      !nombre.trim() ||
      !creador.trim() ||
      nivelesValidos.length === 0 ||
      valoresValidos.length === 0
    ) {
      setError('Completa nombre, creador, al menos un nivel y un valor.')
      return
    }
    const nombresNivel = nivelesValidos.map((n) => n.nombre.trim())
    if (new Set(nombresNivel).size !== nombresNivel.length) {
      setError('Los nombres de niveles deben ser únicos.')
      return
    }
    setStep('preview')
  }

  async function crearTier() {
    setError(null)
    const nivelesValidos = niveles.filter((n) => n.nombre.trim().length > 0)
    const valoresValidos = items.filter((it) => it.nombre.trim().length > 0)
    setSubmitting(true)
    try {
      const slug = `${slugify(nombre)}-${Math.random().toString(36).slice(2, 6)}`
      const { tier, valores: creados } = await createTier({
        slug,
        nombre: nombre.trim(),
        niveles: nivelesValidos.map((n) => ({ nombre: n.nombre.trim(), imagen_url: null })),
        fecha_limite: fechaLimite ? new Date(fechaLimite).toISOString() : null,
        creador: creador.trim(),
        etiqueta_valores: etiquetaValores.trim() || null,
        ancho_titulo: anchoTitulo,
        valores: valoresValidos.map((it) => ({ nombre: it.nombre.trim() })),
      })

      const uploads = []

      if (imagenFile) {
        uploads.push(
          uploadTierImagen(tier.id, imagenFile).then((url) =>
            updateTier(tier.id, { imagen_url: url }),
          ),
        )
      }

      const nivelImgUrls = await Promise.all(
        nivelesValidos.map((n) => (n.file ? uploadNivelImagen(tier.id, n.file) : null)),
      )
      if (nivelImgUrls.some((u) => u)) {
        const nivelesPayload = nivelesValidos.map((n, idx) => ({
          nombre: n.nombre.trim(),
          imagen_url: nivelImgUrls[idx],
        }))
        uploads.push(updateTier(tier.id, { niveles: nivelesPayload }))
      }

      uploads.push(
        ...valoresValidos.map(async (it, idx) => {
          if (!it.file) return
          const url = await uploadValorImagen(tier.id, it.file)
          await updateValor(creados[idx].id, { imagen_url: url })
        }),
      )

      await Promise.all(uploads)

      if (!nombreUsuario) setNombreUsuario(creador.trim())
      navigate(`/tiers/${slug}`)
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  if (step === 'preview') {
    const nivelesValidos = niveles.filter((n) => n.nombre.trim().length > 0)
    const valoresValidos = items.filter((it) => it.nombre.trim().length > 0)
    return (
      <div>
        <h2>Previsualización</h2>
        <p className="text-muted small">
          Ajusta la anchura de los títulos. Cuando estés conforme, crea el tier.
        </p>

        <div className="d-flex align-items-center gap-2 mb-3" style={{ maxWidth: 400 }}>
          <label className="form-label m-0 small text-nowrap">
            Anchura títulos: {anchoTitulo}px
          </label>
          <input
            type="range"
            className="form-range"
            min="60"
            max="240"
            step="5"
            value={anchoTitulo}
            onChange={(e) => setAnchoTitulo(Number(e.target.value))}
          />
        </div>

        <div className="tier-board mb-3">
          <div className="tier-board__header">
            <div className="tier-board__title">{nombre}</div>
            {creador && <div className="tier-board__user">por {creador}</div>}
          </div>
          {nivelesValidos.map((n, idx) => {
            const labelStyle = {
              background: colorNivel(idx, nivelesValidos.length),
              flex: `0 0 ${anchoTitulo}px`,
              width: `${anchoTitulo}px`,
            }
            return (
              <div className="tier-row" key={n.id}>
                <div className="tier-row__label" style={labelStyle} title={n.nombre}>
                  {n.previewUrl ? (
                    <img src={n.previewUrl} alt={n.nombre} draggable={false} />
                  ) : (
                    <span className="tier-row__label-text">{n.nombre}</span>
                  )}
                </div>
                <div className="tier-row__drop" />
              </div>
            )
          })}
        </div>

        <h5>{etiquetaValores.trim() || 'Valores'}</h5>
        <div className="tier-unassigned mb-3">
          {valoresValidos.map((v) => (
            <div key={v.id} className="valor-card" title={v.nombre}>
              {v.previewUrl ? (
                <img src={v.previewUrl} alt={v.nombre} draggable={false} />
              ) : (
                <span className="iniciales">{iniciales(v.nombre)}</span>
              )}
            </div>
          ))}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setStep('form')}
            disabled={submitting}
          >
            Volver a editar
          </button>
          <button
            type="button"
            className="btn btn-primary ms-auto"
            onClick={crearTier}
            disabled={submitting}
          >
            {submitting ? 'Creando…' : 'Crear tier'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>Nuevo tier</h2>
      <form onSubmit={irAPreview} className="vstack gap-3" style={{ maxWidth: 640 }}>
        <div>
          <label className="form-label">Nombre del tier</label>
          <input
            className="form-control"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="p.ej. Mejores series 2026"
          />
        </div>
        <div>
          <label className="form-label">Imagen del tier (opcional, máx 2 MB)</label>
          <input
            type="file"
            accept="image/*"
            className="form-control"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setPendingCrop({
                  file,
                  onAccept: (cropped) => {
                    setImagenFile(cropped)
                    setPendingCrop(null)
                  },
                })
              }
              e.target.value = ''
            }}
          />
          {imagenFile && (
            <div className="small text-muted mt-1">Imagen recortada lista.</div>
          )}
        </div>
        <div>
          <label className="form-label">Nombre (creador)</label>
          <input
            className="form-control"
            value={creador}
            onChange={(e) => setCreador(e.target.value)}
          />
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
          <label className="form-label d-flex align-items-center">
            Niveles <span className="text-muted small ms-2">({niveles.length})</span>
          </label>
          <div className="d-flex gap-2 mb-2">
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
            <button type="button" className="btn btn-success" onClick={añadirNivel}>
              Añadir
            </button>
          </div>
          <ul className="list-group">
            {niveles.map((it) => (
              <li key={it.id} className="list-group-item d-flex align-items-center gap-2">
                <div className="valor-thumb">
                  {it.previewUrl ? (
                    <img src={it.previewUrl} alt={it.nombre} />
                  ) : (
                    <span className="iniciales">{iniciales(it.nombre)}</span>
                  )}
                </div>
                <input
                  className="form-control form-control-sm"
                  value={it.nombre}
                  onChange={(e) => renombrarNivel(it.id, e.target.value)}
                />
                <label className="btn btn-sm btn-outline-primary mb-0">
                  <i className="bi bi-image"></i>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setPendingCrop({
                          file,
                          onAccept: (cropped) => {
                            asignarImagenNivel(it.id, cropped)
                            setPendingCrop(null)
                          },
                        })
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => eliminarNivel(it.id)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="form-label d-flex align-items-center">
            Valores <span className="text-muted small ms-2">({items.length})</span>
          </label>
          <div className="d-flex gap-2 mb-2">
            <input
              className="form-control"
              placeholder="Nuevo valor…"
              value={nuevoValor}
              onChange={(e) => setNuevoValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  añadirValor()
                }
              }}
            />
            <button type="button" className="btn btn-success" onClick={añadirValor}>
              Añadir
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-muted small m-0">Añade al menos un valor.</p>
          ) : (
            <ul className="list-group">
              {items.map((it) => (
                <li key={it.id} className="list-group-item d-flex align-items-center gap-2">
                  <div className="valor-thumb">
                    {it.previewUrl ? (
                      <img src={it.previewUrl} alt={it.nombre} />
                    ) : (
                      <span className="iniciales">{iniciales(it.nombre)}</span>
                    )}
                  </div>
                  <input
                    className="form-control form-control-sm"
                    value={it.nombre}
                    onChange={(e) => renombrarValor(it.id, e.target.value)}
                  />
                  <label className="btn btn-sm btn-outline-primary mb-0">
                    <i className="bi bi-image"></i>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setPendingCrop({
                            file,
                            onAccept: (cropped) => {
                              asignarImagenValor(it.id, cropped)
                              setPendingCrop(null)
                            },
                          })
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => eliminarValor(it.id)}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="form-label">Fecha límite (opcional)</label>
          <input
            type="date"
            className="form-control"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
          />
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <button type="submit" className="btn btn-primary">
          Previsualizar
        </button>
      </form>
      <CropModal
        file={pendingCrop?.file ?? null}
        onCancel={() => setPendingCrop(null)}
        onAccept={(f) => pendingCrop?.onAccept?.(f)}
      />
    </div>
  )
}
