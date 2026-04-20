import { useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Link, useParams } from 'react-router-dom'
import { Modal } from 'react-bootstrap'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { format } from 'date-fns'
import {
  getTierBySlug,
  getValores,
  getAsignaciones,
  upsertAsignacion,
  deleteAsignacion,
} from '../services/tiersApi.js'
import TierRow from '../components/TierRow.jsx'
import ValorCard from '../components/ValorCard.jsx'
import NombreUsuarioInput from '../components/NombreUsuarioInput.jsx'
import useUserStore from '../store/useUserStore.js'
import useAuthStore from '../store/useAuthStore.js'

const UNASSIGNED = '__unassigned__'
const DROP_PREFIX = 'nivel:'

function UnassignedDrop({ valores, onClickValor }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_PREFIX + UNASSIGNED })
  return (
    <div ref={setNodeRef} className={`tier-unassigned ${isOver ? 'is-over' : ''}`}>
      <SortableContext
        items={valores.map((v) => v.id)}
        strategy={horizontalListSortingStrategy}
      >
        {valores.map((v) => (
          <ValorCard key={v.id} valor={v} onClick={onClickValor} />
        ))}
      </SortableContext>
    </div>
  )
}

export default function TierView() {
  const { slug } = useParams()
  const nombre = useUserStore((s) => s.nombre)
  const session = useAuthStore((s) => s.session)

  const [tier, setTier] = useState(null)
  const [valores, setValores] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [resultadoOpen, setResultadoOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewBlob, setPreviewBlob] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const [detalleValor, setDetalleValor] = useState(null)
  const [detalleNivel, setDetalleNivel] = useState(null)
  const boardRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    ;(async () => {
      try {
        const t = await getTierBySlug(slug)
        if (cancel) return
        setTier(t)
        const [v, a] = await Promise.all([
          getValores(t.id),
          nombre ? getAsignaciones(t.id, nombre) : Promise.resolve([]),
        ])
        if (cancel) return
        setValores(v)
        setAsignaciones(a.map((x) => ({ valor_id: x.valor_id, nivel: x.nivel, orden: x.orden })))
      } catch (e) {
        if (!cancel) setError(e.message)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [slug, nombre])

  const porNivel = useMemo(() => {
    if (!tier) return {}
    const out = { [UNASSIGNED]: [] }
    for (const n of tier.niveles) out[n.nombre] = []
    const byId = new Map(valores.map((v) => [v.id, v]))
    const asignados = new Set()
    const ordenados = [...asignaciones].sort((a, b) => a.orden - b.orden)
    for (const a of ordenados) {
      const v = byId.get(a.valor_id)
      if (!v) continue
      if (out[a.nivel]) {
        out[a.nivel].push(v)
        asignados.add(v.id)
      }
    }
    for (const v of valores) {
      if (!asignados.has(v.id)) out[UNASSIGNED].push(v)
    }
    return out
  }, [tier, valores, asignaciones])

  const activeValor = useMemo(
    () => (activeId ? valores.find((v) => v.id === activeId) : null),
    [activeId, valores],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Combine pointerWithin (best when cursor is over something) with
  // rectIntersection fallback (when cursor is over a gap between items).
  function collisionDetection(args) {
    const pointer = pointerWithin(args)
    if (pointer.length > 0) return pointer
    return rectIntersection(args)
  }

  function nivelDeValor(valorId) {
    const a = asignaciones.find((x) => x.valor_id === valorId)
    return a ? a.nivel : UNASSIGNED
  }

  function destinoDesdeOver(over) {
    if (!over) return null
    if (typeof over.id === 'string' && over.id.startsWith(DROP_PREFIX)) {
      return over.id.slice(DROP_PREFIX.length)
    }
    return nivelDeValor(over.id)
  }

  async function handleDragEnd(event) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const valorId = active.id
    const nivelOrigen = nivelDeValor(valorId)
    const nivelDestino = destinoDesdeOver(over)
    if (!nivelDestino) return

    if (nivelDestino === UNASSIGNED) {
      if (nivelOrigen === UNASSIGNED) return
      setAsignaciones((prev) => prev.filter((x) => x.valor_id !== valorId))
      setGuardado(false)
      if (nombre) {
        try {
          await deleteAsignacion({ tier_id: tier.id, usuario: nombre, valor_id: valorId })
        } catch (e) {
          setError(e.message)
        }
      }
      return
    }

    const destinoIds = porNivel[nivelDestino].map((v) => v.id)
    const overIndex = destinoIds.indexOf(over.id)
    const insertIndex = overIndex === -1 ? destinoIds.length : overIndex

    let nextAsign
    if (nivelOrigen === nivelDestino) {
      const ordenActual = destinoIds.indexOf(valorId)
      if (ordenActual === insertIndex) return
      const reordenados = arrayMove(destinoIds, ordenActual, insertIndex)
      nextAsign = [
        ...asignaciones.filter((x) => x.nivel !== nivelDestino),
        ...reordenados.map((id, idx) => ({ valor_id: id, nivel: nivelDestino, orden: idx })),
      ]
    } else {
      const sinValor = destinoIds.filter((id) => id !== valorId)
      sinValor.splice(insertIndex, 0, valorId)
      nextAsign = [
        ...asignaciones.filter((x) => x.valor_id !== valorId && x.nivel !== nivelDestino),
        ...sinValor.map((id, idx) => ({ valor_id: id, nivel: nivelDestino, orden: idx })),
      ]
    }
    setAsignaciones(nextAsign)
    setGuardado(false)

    if (nombre) {
      try {
        const filas = nextAsign.filter((x) => x.nivel === nivelDestino)
        await Promise.all(
          filas.map((f) =>
            upsertAsignacion({
              tier_id: tier.id,
              usuario: nombre,
              valor_id: f.valor_id,
              nivel: f.nivel,
              orden: f.orden,
            }),
          ),
        )
      } catch (e) {
        setError(e.message)
      }
    }
  }

  async function abrirResultado() {
    if (!boardRef.current || generando) return
    if (!nombre) {
      const ok = window.confirm(
        'No has introducido nombre. Se guardará como "Anónimo". ¿Continuar?',
      )
      if (!ok) return
    }
    setGenerando(true)
    setError(null)
    try {
      const usuario = nombre || 'Anónimo'
      await Promise.all(
        asignaciones.map((a) =>
          upsertAsignacion({
            tier_id: tier.id,
            usuario,
            valor_id: a.valor_id,
            nivel: a.nivel,
            orden: a.orden,
          }),
        ),
      )
      const node = boardRef.current
      node.classList.add('tier-board--capture')
      let blob
      try {
        const rect = node.getBoundingClientRect()
        const width = Math.ceil(rect.width)
        const height = Math.ceil(rect.height)
        blob = await toBlob(node, {
          pixelRatio: 2,
          backgroundColor: '#d6dee9',
          cacheBust: true,
          width,
          height,
          canvasWidth: width,
          canvasHeight: height,
        })
      } finally {
        node.classList.remove('tier-board--capture')
      }
      if (!blob) throw new Error('No se pudo generar la imagen.')
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setGuardado(true)
      setResultadoOpen(true)
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`)
    } finally {
      setGenerando(false)
    }
  }

  async function devolverTodos() {
    if (!tier || asignaciones.length === 0) return
    const aDevolver = [...asignaciones]
    const apply = () => {
      setAsignaciones([])
      setGuardado(false)
    }
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(apply)
    } else {
      apply()
    }
    if (nombre) {
      try {
        await Promise.all(
          aDevolver.map((a) =>
            deleteAsignacion({ tier_id: tier.id, usuario: nombre, valor_id: a.valor_id }),
          ),
        )
      } catch (e) {
        setError(e.message)
      }
    }
  }

  function compartirTierWhatsapp() {
    const url = window.location.href
    const texto = `Mira este tier: ${tier.nombre} — ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  function compartirTierEmail() {
    const url = window.location.href
    const subject = `Tier: ${tier.nombre}`
    const body = `Mira este tier:\n\n${tier.nombre}\n${url}`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  function compartirTierTelegram() {
    const url = window.location.href
    const texto = `Mira este tier: ${tier.nombre}`
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function compartirWhatsapp() {
    const url = window.location.href
    const texto = `Mira mi tier de ${tier.nombre}: ${url}`
    if (previewBlob && typeof navigator.canShare === 'function') {
      const file = new File([previewBlob], `${tier.slug}.png`, { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: texto, title: tier.nombre })
          return
        } catch (e) {
          if (e.name === 'AbortError') return
        }
      }
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(wa, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <p>Cargando…</p>
  if (error) return <div className="alert alert-danger">{error}</div>
  if (!tier) return null

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link to={`/tiers/${tier.slug}/estadisticas`} className="btn btn-sm btn-outline-dark">
          <i className="bi bi-bar-chart"></i> Estadísticas
        </Link>
        {tier.modo_apuesta && (
          <Link to={`/tiers/${tier.slug}/apuestas`} className="btn btn-sm btn-outline-warning">
            <i className="bi bi-trophy"></i> Puntuaciones
          </Link>
        )}
        {session && (
          <Link
            to={`/tiers/${tier.slug}/editar`}
            className="btn btn-sm btn-outline-primary ms-auto"
          >
            <i className="bi bi-pencil"></i> Editar tier
          </Link>
        )}
      </div>
      <div className="tier-cabecera d-flex align-items-center gap-3 mb-3">
        {tier.imagen_url && (
          <div className="tier-hero-thumb">
            <img src={tier.imagen_url} alt={tier.nombre} />
          </div>
        )}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <h4 className="m-0 text-break">{tier.nombre}</h4>
          <div className="small text-muted">
            por {tier.creador}
            {tier.fecha_limite && ` · hasta ${format(new Date(tier.fecha_limite), 'dd/MM/yyyy')}`}
          </div>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(e) => setActiveId(e.active.id)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="d-flex align-items-center gap-2 mb-2">
          <h6 className="m-0">{tier.etiqueta_valores || 'Valores'}</h6>
          <button
            type="button"
            className="btn btn-outline-secondary py-0 px-2"
            style={{ fontSize: '0.75rem' }}
            onClick={devolverTodos}
            disabled={asignaciones.length === 0}
            title="Devolver todos los valores al bloque"
          >
            <i className="bi bi-arrow-counterclockwise"></i> Devolver todo
          </button>
        </div>
        <UnassignedDrop
          valores={porNivel[UNASSIGNED] ?? []}
          onClickValor={setDetalleValor}
        />
        <div ref={boardRef} className="tier-board mt-4">
          <div className="tier-board__header">
            <div className="tier-board__title">{tier.nombre}</div>
            {nombre && <div className="tier-board__user">por {nombre}</div>}
          </div>
          {tier.niveles.map((nivel, idx) => (
            <TierRow
              key={nivel.nombre}
              nivel={nivel}
              index={idx}
              total={tier.niveles.length}
              valores={porNivel[nivel.nombre] ?? []}
              anchoTitulo={tier.ancho_titulo ?? 110}
              onClickLabel={tier.modo_apuesta ? setDetalleNivel : undefined}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {activeValor ? <ValorCard valor={activeValor} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
      <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
        <NombreUsuarioInput className="d-flex gap-2 align-items-center m-0" />
        <button
          type="button"
          className="btn btn-sm btn-success"
          onClick={abrirResultado}
          disabled={generando}
        >
          <i className="bi bi-check2-circle"></i>{' '}
          {generando ? 'Generando…' : 'Guardar'}
        </button>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-success"
          onClick={compartirTierWhatsapp}
          disabled={!guardado}
          title={guardado ? 'Compartir tier por WhatsApp' : 'Guarda primero para compartir'}
        >
          <i className="bi bi-whatsapp"></i> WhatsApp
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={compartirTierEmail}
          disabled={!guardado}
          title={guardado ? 'Compartir tier por email' : 'Guarda primero para compartir'}
        >
          <i className="bi bi-envelope"></i> Email
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-info"
          onClick={compartirTierTelegram}
          disabled={!guardado}
          title={guardado ? 'Compartir tier por Telegram' : 'Guarda primero para compartir'}
        >
          <i className="bi bi-telegram"></i> Telegram
        </button>
      </div>

      <Modal show={!!detalleNivel} onHide={() => setDetalleNivel(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{detalleNivel?.nombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <div className="fs-5">
            Puntos por acierto en este nivel:{' '}
            <span className="badge bg-success fs-5">
              {Number(tier.puntos_por_nivel?.[detalleNivel?.nombre]) || 0} pts
            </span>
          </div>
        </Modal.Body>
      </Modal>

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

      <Modal show={resultadoOpen} onHide={() => setResultadoOpen(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Tu tier de {tier.nombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewUrl && (
            <div className="text-center mb-3">
              <img
                src={previewUrl}
                alt="Tu tier"
                style={{ maxWidth: '100%', borderRadius: 8 }}
              />
            </div>
          )}
          <div className="d-flex flex-wrap gap-2 justify-content-center">
            <button type="button" className="btn btn-success" onClick={compartirWhatsapp}>
              <i className="bi bi-whatsapp"></i> Compartir por WhatsApp
            </button>
            <a
              className="btn btn-primary"
              href={previewUrl ?? '#'}
              download={`${tier.slug}.png`}
            >
              <i className="bi bi-download"></i> Descargar imagen
            </a>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setResultadoOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}
