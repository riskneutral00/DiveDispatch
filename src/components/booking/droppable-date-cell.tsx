'use client'

import { useDroppable } from '@dnd-kit/core'

/** Droppable date cell wrapper — requires DndContext ancestor */
export function DroppableDateCell({
  dateString,
  isBlocked,
  isPast,
  children,
}: {
  dateString: string
  isBlocked: boolean
  isPast: boolean
  children: (isOver: boolean) => React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `date-${dateString}`,
    data: { type: 'calendar-date', date: dateString },
    disabled: isBlocked || isPast,
  })

  return (
    <div ref={setNodeRef}>
      {children(isOver && !isBlocked && !isPast)}
    </div>
  )
}
