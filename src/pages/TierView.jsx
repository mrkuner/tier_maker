import { useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Modal } from 'react-bootstrap'
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
import { useConfirm } from '../components/ConfirmModal.jsx'
import useUserStore from '../store/useUserStore.js'
import useAuthStore from '../store/useAuthStore.js'
import useMisTiersStore from '../store/useMisTiersStore.js'
import useMisRankingsStore from '../store/useMisRankingsStore.js'
import usePrefsStore from '../store/usePrefsStore.js'
import { puedeEditarTier, tierBloqueado } from '../utils/permisos.js'

const UNASSIGNED = '__unassigned__'
const DROP_PREFIX = 'nivel:'

function UnassignedDrop({ valores, onClickValor, modoTexto, titulo }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_PREFIX + UNASSIGNED })
  return (
    <div ref={setNodeRef} className={`tier-unassigned ${isOver ? 'is-over' : ''}`}>
      {titulo && <span className="tier-unassigned__title">{titulo}</span>}
      <SortableContext
        items={valores.map((v) => v.id)}
        strategy={horizontalListSortingStrategy}
      >
        {valores.map((v) => (
          <ValorCard key={v.id} valor={v} onClick={onClickValor} modoTexto={modoTexto} />
        ))}
      </SortableContext>
    </div>
  )
}

export default function TierView() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const rankingVisitado = searchParams.get('r')
  const nombre = useUserStore((s) => s.nombre)
  const session = useAuthStore((s) => s.session)
  const tokens = useMisTiersStore((s) => s.tokens)
  const getRankingLocal = useMisRankingsStore((s) => s.getRankingId)
  const getNombreLocal = useMisRankingsStore((s) => s.getNombre)
  const setRankingLocal = useMisRankingsStore((s) => s.setRanking)

  const [tier, setTier] = useState(null)
  const [valores, setValores] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [rankingId, setRankingId] = useState(null)
  const [nombreRanking, setNombreRanking] = useState(null)
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
  const esVisita = Boolean(rankingVisitado) && rankingVisitado !== getRankingLocal(tier?.id)
  const modoTexto = usePrefsStore((s) => s.modoTexto)
  const toggleModoTexto = usePrefsStore((s) => s.toggleModoTexto)
  const [zoom, setZoom] = useState(1)
  const boardRef = useRef(null)
  const justDragged = useRef(false)
  const rankingIdRef = useRef(null)
  const { confirm, element: confirmEl } = useConfirm()

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--card-size', `${Math.round(58 * zoom)}px`)
    return () => {
      root.style.removeProperty('--card-size')
    }
  }, [zoom])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    ;(async () => {
      try {
        const t = await getTierBySlug(slug)
        if (cancel) return
        setTier(t)
        const rankingCarga = rankingVisitado || getRankingLocal(t.id)
        const [v, a] = await Promise.all([
          getValores(t.id),
          rankingCarga
            ? getAsignaciones(t.id, { ranking_id: rankingCarga })
            : Promise.resolve([]),
        ])
        if (cancel) return
        setValores(v)
        setRankingId(rankingCarga || null)
        rankingIdRef.current = rankingCarga || null
        setNombreRanking(a[0]?.usuario ?? getNombreLocal(t.id) ?? null)
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
  }, [slug, rankingVisitado, getRankingLocal, getNombreLocal])

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

  const tierFinalizado = useMemo(
    () => Boolean(tier?.modo_apuesta) && valores.length > 0 && valores.every((v) => v.nivel_correcto),
    [tier, valores],
  )
  const resultadosPorId = useMemo(() => {
    if (!tierFinalizado) return null
    const map = new Map()
    const correctoPorId = new Map(valores.map((v) => [v.id, v.nivel_correcto]))
    for (const a of asignaciones) {
      const correcto = correctoPorId.get(a.valor_id)
      if (!correcto) continue
      map.set(a.valor_id, a.nivel === correcto ? 'acierto' : 'fallo')
    }
    return map
  }, [tierFinalizado, valores, asignaciones])
  const puntosUsuarioPorNivel = useMemo(() => {
    if (!tierFinalizado) return null
    const puntosNivel = tier?.puntos_por_nivel ?? {}
    const correctoPorId = new Map(valores.map((v) => [v.id, v.nivel_correcto]))
    const out = {}
    for (const a of asignaciones) {
      if (correctoPorId.get(a.valor_id) !== a.nivel) continue
      const p = Number(puntosNivel[a.nivel]) || 0
      out[a.nivel] = (out[a.nivel] ?? 0) + p
    }
    return out
  }, [tierFinalizado, tier, valores, asignaciones])
  const tierCerrado = tierBloqueado(tier) && !tierFinalizado
  const bloquearAcciones = esVisita || tierFinalizado || (tierBloqueado(tier) && !session)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 60, tolerance: 10 } }),
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

  function ensureRankingId(usuario) {
    if (rankingIdRef.current) return rankingIdRef.current
    const rid = crypto.randomUUID()
    rankingIdRef.current = rid
    setRankingId(rid)
    setNombreRanking(usuario)
    if (tier?.id) setRankingLocal(tier.id, rid, usuario)
    return rid
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
    if (bloquearAcciones) return
    const valorId = active.id
    const nivelOrigen = nivelDeValor(valorId)
    const nivelDestino = destinoDesdeOver(over)
    if (!nivelDestino) return

    if (nivelDestino === UNASSIGNED) {
      if (nivelOrigen === UNASSIGNED) return
      setAsignaciones((prev) => prev.filter((x) => x.valor_id !== valorId))
      setGuardado(false)
      if (nombre && rankingIdRef.current) {
        try {
          await deleteAsignacion({ ranking_id: rankingIdRef.current, valor_id: valorId })
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
        const rid = ensureRankingId(nombre)
        const filas = nextAsign.filter((x) => x.nivel === nivelDestino)
        await Promise.all(
          filas.map((f) =>
            upsertAsignacion({
              tier_id: tier.id,
              ranking_id: rid,
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
      const ok = await confirm({
        title: 'Guardar como Anónimo',
        message:
          'No has introducido nombre. Se guardará como "Anónimo". ¿Quieres continuar?',
        confirmText: 'Guardar como Anónimo',
        cancelText: 'Cancelar',
        variant: 'warning',
        icon: 'bi-person-exclamation',
      })
      if (!ok) return
    }
    setGenerando(true)
    setError(null)
    try {
      const usuario = nombre || 'Anónimo'
      const rid = ensureRankingId(usuario)
      await Promise.all(
        asignaciones.map((a) =>
          upsertAsignacion({
            tier_id: tier.id,
            ranking_id: rid,
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

  async function asignarAleatoriamente() {
    if (!tier) return
    const nombresNivel = tier.niveles.map((n) => n.nombre)
    if (nombresNivel.length === 0) return
    const yaAsignados = new Set(asignaciones.map((a) => a.valor_id))
    const sinAsignar = valores.filter((v) => !yaAsignados.has(v.id))
    if (sinAsignar.length === 0) return
    const conteoPorNivel = {}
    for (const a of asignaciones) {
      conteoPorNivel[a.nivel] = (conteoPorNivel[a.nivel] ?? 0) + 1
    }
    const nuevas = []
    for (const v of sinAsignar) {
      const nivel = nombresNivel[Math.floor(Math.random() * nombresNivel.length)]
      const orden = conteoPorNivel[nivel] ?? 0
      conteoPorNivel[nivel] = orden + 1
      nuevas.push({ valor_id: v.id, nivel, orden })
    }
    const nextAsign = [...asignaciones, ...nuevas]
    const apply = () => {
      setAsignaciones(nextAsign)
      setGuardado(false)
    }
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(apply)
    } else {
      apply()
    }
    if (nombre) {
      try {
        const rid = ensureRankingId(nombre)
        await Promise.all(
          nuevas.map((a) =>
            upsertAsignacion({
              tier_id: tier.id,
              ranking_id: rid,
              usuario: nombre,
              valor_id: a.valor_id,
              nivel: a.nivel,
              orden: a.orden,
            }),
          ),
        )
      } catch (e) {
        setError(e.message)
      }
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
    if (nombre && rankingIdRef.current) {
      try {
        const rid = rankingIdRef.current
        await Promise.all(
          aDevolver.map((a) =>
            deleteAsignacion({ ranking_id: rid, valor_id: a.valor_id }),
          ),
        )
      } catch (e) {
        setError(e.message)
      }
    }
  }

  function urlBase() {
    return `${window.location.origin}${window.location.pathname}`
  }

  function compartirTierWhatsapp() {
    const url = urlBase()
    const texto = `Mira este tier: ${tier.nombre} — ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  function compartirMiRankingWhatsapp() {
    if (!rankingId) return
    const url = `${urlBase()}?r=${rankingId}`
    const texto = `Mira mi ranking de ${tier.nombre}: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  async function copiarMiRanking() {
    if (!rankingId) return
    const url = `${urlBase()}?r=${rankingId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copia el enlace:', url)
    }
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

  function handleClickValor(valor) {
    if (justDragged.current) return
    setDetalleValor(valor)
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
        {session && tier.modo_apuesta && (
          <Link
            to={`/tiers/${tier.slug}/corregir`}
            className="btn btn-sm btn-outline-success"
          >
            <i className="bi bi-check2-all"></i> Corregir
          </Link>
        )}
        {puedeEditarTier(tier, session, tokens) && (
          <Link
            to={`/tiers/${tier.slug}/editar`}
            className="btn btn-sm btn-outline-primary ms-auto"
          >
            <i className="bi bi-pencil"></i> Editar tier
          </Link>
        )}
      </div>
      {esVisita && (
        <div className="alert alert-info d-flex flex-wrap align-items-center gap-2 mb-3 py-2">
          <i className="bi bi-eye"></i>
          <span>
            Estás viendo el ranking de{' '}
            <strong>{nombreRanking || 'otro usuario'}</strong>
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary ms-auto"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            <i className="bi bi-pencil"></i> Hacer el mío
          </button>
        </div>
      )}
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
        {tierFinalizado && (
          <span className="tier-cabecera__estado tier-cabecera__estado--finalizado">
            FINALIZADO
          </span>
        )}
        {tierCerrado && (
          <span className="tier-cabecera__estado tier-cabecera__estado--cerrado">
            CERRADO
          </span>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(e) => { setActiveId(e.active.id); justDragged.current = true }}
        onDragCancel={() => { setActiveId(null); setTimeout(() => { justDragged.current = false }, 50) }}
        onDragEnd={(e) => { handleDragEnd(e); setTimeout(() => { justDragged.current = false }, 50) }}
      >
        <div className="tier-dock">
        <div className="d-flex align-items-center gap-2 mb-2 flex-nowrap tier-dock__actions">
          <button
            type="button"
            className="btn btn-outline-secondary py-0 px-2"
            style={{ fontSize: '0.75rem' }}
            onClick={toggleModoTexto}
            title={modoTexto ? 'Mostrar como imágenes' : 'Mostrar como texto'}
          >
            <i className={`bi ${modoTexto ? 'bi-image' : 'bi-fonts'}`}></i>{' '}
            {modoTexto ? 'Ver imágenes' : 'Ver texto'}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary py-0 px-2"
            style={{ fontSize: '0.75rem' }}
            onClick={asignarAleatoriamente}
            disabled={
              valores.length === 0 ||
              asignaciones.length === valores.length ||
              bloquearAcciones
            }
            title="Asignar aleatoriamente los valores que quedan sin clasificar"
          >
            <i className="bi bi-shuffle"></i> Asignar Aleatorio
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary py-0 px-2"
            style={{ fontSize: '0.75rem' }}
            onClick={devolverTodos}
            disabled={asignaciones.length === 0 || bloquearAcciones}
            title="Devolver todos los valores al bloque"
          >
            <i className="bi bi-arrow-counterclockwise"></i> Devolver todos
          </button>
          {/* Zoom oculto temporalmente */}
        </div>
        <div className="mt-4 tier-dock__panel">
          <UnassignedDrop
            valores={porNivel[UNASSIGNED] ?? []}
            onClickValor={handleClickValor}
            modoTexto={modoTexto}
            titulo={tier.etiqueta_valores || 'Valores'}
          />
        </div>
        </div>
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
              modoTexto={modoTexto}
              onClickValor={handleClickValor}
              puntos={
                tier.modo_apuesta
                  ? Number(tier.puntos_por_nivel?.[nivel.nombre]) || 0
                  : null
              }
              resultados={resultadosPorId}
              puntosUsuario={
                puntosUsuarioPorNivel ? puntosUsuarioPorNivel[nivel.nombre] ?? 0 : null
              }
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {activeValor ? <ValorCard valor={activeValor} isOverlay modoTexto={modoTexto} /> : null}
        </DragOverlay>
      </DndContext>
      {!esVisita && (
        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          <NombreUsuarioInput className="d-flex gap-2 align-items-center m-0" />
          <button
            type="button"
            className="btn btn-sm btn-success"
            onClick={abrirResultado}
            disabled={generando || bloquearAcciones}
          >
            <i className="bi bi-check2-circle"></i>{' '}
            {generando ? 'Generando…' : 'Guardar'}
          </button>
        </div>
      )}
      {!esVisita && (
        <div className="d-flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            onClick={compartirMiRankingWhatsapp}
            disabled={!guardado || !rankingId}
            title={
              guardado
                ? 'Compartir tu ranking por WhatsApp'
                : 'Guarda primero para compartir tu ranking'
            }
          >
            <i className="bi bi-whatsapp"></i> Compartir mi ranking
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={copiarMiRanking}
            disabled={!guardado || !rankingId}
            title="Copiar enlace a tu ranking"
          >
            <i className="bi bi-link-45deg"></i> Copiar enlace
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={compartirTierWhatsapp}
            title="Invitar a otros a hacer su propio ranking"
          >
            <i className="bi bi-share"></i> Compartir tier
          </button>
        </div>
      )}

      {confirmEl}

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
