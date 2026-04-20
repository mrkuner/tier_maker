import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { iniciales } from '../utils/iniciales.js'

export default function ValorCard({ valor, isOverlay = false, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: valor.id,
    disabled: isOverlay,
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
    if (!tieneImagen || isOverlay) return
    e.stopPropagation()
    setShowName((v) => !v)
  }
  const handleClick = (e) => {
    if (isOverlay || !onClick) return
    e.stopPropagation()
    onClick(valor)
  }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className="valor-card"
      title={valor.nombre}
    >
      {tieneImagen ? (
        showName ? (
          <span className="valor-card__name">{valor.nombre}</span>
        ) : (
          <img src={valor.imagen_url} alt={valor.nombre} draggable={false} />
        )
      ) : (
        <span className="iniciales">{iniciales(valor.nombre)}</span>
      )}
    </div>
  )
}
