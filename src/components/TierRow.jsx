import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import ValorCard from './ValorCard.jsx'

export function colorNivel(index, total) {
  if (!total || total <= 1) return 'hsl(120, 70%, 70%)'
  const hue = 120 - (120 * index) / (total - 1)
  return `hsl(${hue}, 70%, 70%)`
}

export default function TierRow({ nivel, index, total, valores, anchoTitulo, onClickLabel }) {
  const { setNodeRef, isOver } = useDroppable({ id: `nivel:${nivel.nombre}` })
  const color = colorNivel(index, total)
  const labelStyle = anchoTitulo
    ? { background: color, flex: `0 0 ${anchoTitulo}px`, width: `${anchoTitulo}px` }
    : { background: color }
  if (onClickLabel) labelStyle.cursor = 'pointer'

  return (
    <div className="tier-row">
      <div
        className="tier-row__label"
        style={labelStyle}
        title={nivel.nombre}
        onClick={onClickLabel ? () => onClickLabel(nivel) : undefined}
      >
        {nivel.imagen_url ? (
          <img src={nivel.imagen_url} alt={nivel.nombre} draggable={false} />
        ) : (
          <span className="tier-row__label-text">{nivel.nombre}</span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`tier-row__drop ${isOver ? 'is-over' : ''}`}
      >
        <SortableContext
          items={valores.map((v) => v.id)}
          strategy={horizontalListSortingStrategy}
        >
          {valores.map((v) => (
            <ValorCard key={v.id} valor={v} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
