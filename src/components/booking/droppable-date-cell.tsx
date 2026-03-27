'use client'

import { useDroppable } from '@dnd-kit/react'
import { useRef, type ReactNode } from 'react'

interface DroppableDateCellProps {
  dateString: string
  disabled: boolean
  children: ReactNode
}

const HIGHLIGHT_STYLE: React.CSSProperties = {
  boxShadow: 'inset 0 0 0 2px var(--color-primary), 0 0 12px var(--color-primary-glow)',
  transition: 'box-shadow 150ms ease',
}

export function DroppableDateCell({ dateString, disabled, children }: DroppableDateCellProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)

  const { isDropTarget, ref } = useDroppable({
    id: `date-${dateString}`,
    data: { type: 'calendar-date', date: dateString },
    disabled,
    element: elementRef,
  })

  const showHighlight = isDropTarget && !disabled

  return (
    <div
      ref={(el) => {
        elementRef.current = el
        ref(el)
      }}
      style={showHighlight ? HIGHLIGHT_STYLE : undefined}
    >
      {children}
    </div>
  )
}
