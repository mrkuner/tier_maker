import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { iniciales } from '../utils/iniciales.js'

export default function ValorCard({ valor, isOverlay = false, onClick, modoTexto = false, resultado = null, bloqueado = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: valor.id,
    disabled: isOverlay || bloqueado,
  })
  const [showName, setShowName] = useState(false)

  const style = isOverlay
    ? { cursor: 'grabbing', boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }
    : {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        viewTransitionName: `valor-${valor.id}`,
      }

  const tieneImagen = Boolean(valor.imagen_url)
  const handleDoubleClick = (e) => {
    if (!tieneImagen || isOverlay || modoTexto) return
    e.stopPropagation()
    setShowName((v) => !v)
  }
  const handleClick = (e) => {
    if (isOverlay || !onClick) return
    e.stopPropagation()
    onClick(valor)
  }

  const className = modoTexto ? 'valor-card valor-card--texto' : 'valor-card'

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={className}
      title={valor.nombre}
    >
      {modoTexto ? (
        <span className="valor-card__texto">{valor.nombre}</span>
      ) : tieneImagen ? (
        showName ? (
          <span className="valor-card__name">{valor.nombre}</span>
        ) : (
          <img src={valor.imagen_url} alt={valor.nombre} draggable={false} />
        )
      ) : (
        <span className="iniciales">{iniciales(valor.nombre)}</span>
      )}
      {resultado && (
        <span className={`valor-card__resultado valor-card__resultado--${resultado}`}>
          <i className={`bi ${resultado === 'acierto' ? 'bi-check-lg' : 'bi-x-lg'}`}></i>
        </span>
      )}
    </div>
  )
}
