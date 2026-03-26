'use client'

import { DndContext, DragOverlay } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'

interface DndCalendarWrapperProps {
  onDragStart: (event: DragStartEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel: () => void
  dragLabel: string | null
  children: React.ReactNode
}

export function DndCalendarWrapper({
  onDragStart,
  onDragEnd,
  onDragCancel,
  dragLabel,
  children,
}: DndCalendarWrapperProps) {
  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      {children}
      <DragOverlay>
        {dragLabel && (
          <div
            className="rounded-full px-3 py-1 font-medium text-xs shadow-lg"
            style={{ color: 'var(--color-text-primary)', background: 'var(--color-primary-glow)', border: '2px solid var(--color-glass-border-hover)', opacity: 0.9 }}
          >
            {dragLabel}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
