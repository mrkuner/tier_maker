import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  getTierBySlug,
  getValores,
  updateValor,
  updateTier,
  clearCorreccion,
  deleteAllAsignaciones,
} from '../services/tiersApi.js'
import TierRow from '../components/TierRow.jsx'
import ValorCard from '../components/ValorCard.jsx'
import { useConfirm } from '../components/ConfirmModal.jsx'
import useAuthStore from '../store/useAuthStore.js'
import { deadlinePasada, tierBloqueado } from '../utils/permisos.js'

const UNASSIGNED = '__unassigned__'
const DROP_PREFIX = 'nivel:'

function UnassignedDrop({ valores, titulo }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_PREFIX + UNASSIGNED })
  return (
    <div ref={setNodeRef} className={`tier-unassigned ${isOver ? 'is-over' : ''}`}>
      {titulo && <span className="tier-unassigned__title">{titulo}</span>}
      <SortableContext
        items={valores.map((v) => v.id)}
        strategy={horizontalListSortingStrategy}
      >
        {valores.map((v) => (
          <ValorCard key={v.id} valor={v} />
        ))}
      </SortableContext>
    </div>
  )
}

export default function TierCorregir() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const [tier, setTier] = useState(null)
  const [valores, setValores] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const { confirm, element: confirmEl } = useConfirm()

  useEffect(() => {
    let cancel = false
    setLoading(true)
    ;(async () => {
      try {
        const t = await getTierBySlug(slug)
        if (cancel) return
        setTier(t)
        const v = await getValores(t.id)
        if (cancel) return
        setValores(v)
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

  const porNivel = useMemo(() => {
    if (!tier) return {}
    const out = { [UNASSIGNED]: [] }
    for (const n of tier.niveles) out[n.nombre] = []
    const ordenados = [...valores].sort((a, b) => a.orden - b.orden)
    for (const v of ordenados) {
      if (v.nivel_correcto && out[v.nivel_correcto]) {
        out[v.nivel_correcto].push(v)
      } else {
        out[UNASSIGNED].push(v)
      }
    }
    return out
  }, [tier, valores])

  const activeValor = useMemo(
    () => (activeId ? valores.find((v) => v.id === activeId) : null),
    [activeId, valores],
  )

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 60, tolerance: 10 } }),
  )

  function collisionDetection(args) {
    const pointer = pointerWithin(args)
    if (pointer.length > 0) return pointer
    return rectIntersection(args)
  }

  function nivelDeValor(valorId) {
    const v = valores.find((x) => x.id === valorId)
    return v?.nivel_correcto || UNASSIGNED
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
    if (!nivelDestino || nivelDestino === nivelOrigen) return
    const nuevoNivel = nivelDestino === UNASSIGNED ? null : nivelDestino
    setValores((prev) =>
      prev.map((v) => (v.id === valorId ? { ...v, nivel_correcto: nuevoNivel } : v)),
    )
    try {
      await updateValor(tier.id, valorId, { nivel_correcto: nuevoNivel })
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleBloqueo() {
    if (!tier) return
    const queremosBloquear = !tier.bloqueado
    const mensajeFechaPasada = deadlinePasada(tier) && !queremosBloquear
      ? ' Nota: la fecha límite ya ha pasado, el tier seguirá bloqueado automáticamente. Cámbiala en "Editar tier" para reabrir.'
      : ''
    const ok = await confirm({
      title: queremosBloquear ? 'Bloquear tier' : 'Desbloquear tier',
      message:
        (queremosBloquear
          ? 'Los usuarios no podrán modificar su asignación mientras el tier esté bloqueado.'
          : 'Los usuarios podrán volver a mover los valores de su tier.') + mensajeFechaPasada,
      confirmText: queremosBloquear ? 'Bloquear' : 'Desbloquear',
      variant: queremosBloquear ? 'warning' : 'primary',
      icon: queremosBloquear ? 'bi-lock' : 'bi-unlock',
    })
    if (!ok) return
    setWorking(true)
    try {
      await updateTier(tier.id, { bloqueado: queremosBloquear })
      setTier((t) => ({ ...t, bloqueado: queremosBloquear }))
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  async function correccionTotal() {
    const faltan = valores.filter((v) => !v.nivel_correcto).length
    const ok = await confirm({
      title: 'Corrección total',
      message: faltan > 0
        ? `Hay ${faltan} valor${faltan === 1 ? '' : 'es'} sin nivel correcto marcado. ¿Aun así quieres calcular el ranking?`
        : 'Se contrastarán las asignaciones de los usuarios con los valores correctos para generar el ranking.',
      confirmText: 'Ver ranking',
      variant: 'success',
      icon: 'bi-trophy',
    })
    if (!ok) return
    navigate(`/tiers/${tier.slug}/apuestas`)
  }

  async function borrarCorreccion() {
    const ok = await confirm({
      title: 'Borrar corrección',
      message: 'Se eliminarán todos los niveles correctos asignados. Los valores volverán al bloque "Sin asignar". ¿Continuar?',
      confirmText: 'Borrar corrección',
      variant: 'danger',
      icon: 'bi-eraser',
    })
    if (!ok) return
    setWorking(true)
    try {
      await clearCorreccion(tier.id)
      setValores((prev) => prev.map((v) => ({ ...v, nivel_correcto: null })))
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  async function borrarPredicciones() {
    const ok = await confirm({
      title: 'Borrar todas las predicciones',
      message: 'Se eliminarán TODAS las asignaciones de TODOS los usuarios en este tier. Esta acción no se puede deshacer. ¿Continuar?',
      confirmText: 'Borrar todo',
      variant: 'danger',
      icon: 'bi-trash',
    })
    if (!ok) return
    setWorking(true)
    try {
      await deleteAllAsignaciones(tier.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  if (!session) return <Navigate to={`/tiers/${slug}`} replace />
  if (loading) return <p>Cargando…</p>
  if (error) return <div className="alert alert-danger">{error}</div>
  if (!tier) return null
  if (!tier.modo_apuesta) {
    return (
      <div>
        <Link to={`/tiers/${tier.slug}`} className="btn btn-sm btn-outline-secondary mb-3">
          <i className="bi bi-arrow-left"></i> Volver al tier
        </Link>
        <div className="alert alert-warning">
          Este tier no tiene modo apuesta activado, no hay nada que corregir.
        </div>
      </div>
    )
  }

  const bloqueadoEfectivo = tierBloqueado(tier)

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link to={`/tiers/${tier.slug}`} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left"></i> Volver al tier
        </Link>
        <Link to={`/tiers/${tier.slug}/apuestas`} className="btn btn-sm btn-outline-warning">
          <i className="bi bi-trophy"></i> Puntuaciones
        </Link>
      </div>
      <div className="tier-cabecera d-flex align-items-center gap-3 mb-3">
        {tier.imagen_url && (
          <div className="tier-hero-thumb">
            <img src={tier.imagen_url} alt={tier.nombre} />
          </div>
        )}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <h4 className="m-0 text-break">Corregir: {tier.nombre}</h4>
          <div className="small text-muted">
            Arrastra cada valor al nivel correcto. Los cambios se guardan automáticamente.
          </div>
        </div>
      </div>

      {bloqueadoEfectivo && (
        <div className="alert alert-secondary py-2 mb-3">
          <i className="bi bi-lock-fill"></i> Tier bloqueado
          {deadlinePasada(tier) && !tier.bloqueado ? ' (fecha límite expirada)' : ''}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(e) => setActiveId(e.active.id)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="tier-dock">
          <div className="d-flex align-items-center gap-2 mb-2 flex-nowrap tier-dock__actions">
            <button
              type="button"
              className={`btn py-0 px-2 ${tier.bloqueado ? 'btn-outline-primary' : 'btn-outline-warning'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={toggleBloqueo}
              disabled={working}
              title={tier.bloqueado ? 'Permitir que los usuarios editen' : 'Impedir que los usuarios editen'}
            >
              <i className={`bi ${tier.bloqueado ? 'bi-unlock' : 'bi-lock'}`}></i>{' '}
              {tier.bloqueado ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button
              type="button"
              className="btn btn-outline-success py-0 px-2"
              style={{ fontSize: '0.75rem' }}
              onClick={correccionTotal}
              disabled={working}
              title="Calcular ranking a partir de los valores correctos"
            >
              <i className="bi bi-check2-all"></i> Corrección total
            </button>
            <button
              type="button"
              className="btn btn-outline-danger py-0 px-2"
              style={{ fontSize: '0.75rem' }}
              onClick={borrarCorreccion}
              disabled={working}
              title="Eliminar todos los niveles correctos"
            >
              <i className="bi bi-eraser"></i> Borrar corrección
            </button>
            <button
              type="button"
              className="btn btn-danger py-0 px-2"
              style={{ fontSize: '0.75rem' }}
              onClick={borrarPredicciones}
              disabled={working}
              title="Eliminar todas las predicciones de todos los usuarios"
            >
              <i className="bi bi-trash"></i> Borrar predicciones
            </button>
          </div>
          <div className="mt-4 tier-dock__panel">
            <UnassignedDrop
              valores={porNivel[UNASSIGNED] ?? []}
              titulo={tier.etiqueta_valores || 'Valores'}
            />
          </div>
        </div>
        <div className="tier-board mt-4">
          <div className="tier-board__header">
            <div className="tier-board__title">{tier.nombre}</div>
            <div className="tier-board__user">Valores correctos</div>
          </div>
          {tier.niveles.map((nivel, idx) => (
            <TierRow
              key={nivel.nombre}
              nivel={nivel}
              index={idx}
              total={tier.niveles.length}
              valores={porNivel[nivel.nombre] ?? []}
              anchoTitulo={tier.ancho_titulo ?? 110}
              puntos={Number(tier.puntos_por_nivel?.[nivel.nombre]) || 0}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {activeValor ? <ValorCard valor={activeValor} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {confirmEl}
    </div>
  )
}
