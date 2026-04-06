'use client'

import { useDraggable } from '@dnd-kit/react'
import { useRef } from 'react'
import type { QuickBookTemplate } from '@/lib/booking/quick-book-templates'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { PILL_BASE, DISABLED_OVERLAY } from '@/components/booking/quick-book-rail'

interface DraggablePillProps {
  template: QuickBookTemplate
  canBook: boolean
  onSelect: (courses: CourseCode[]) => void
  style?: React.CSSProperties
}

export function DraggablePill({ template, canBook, onSelect, style }: DraggablePillProps) {
  const elementRef = useRef<HTMLButtonElement | null>(null)

  const { isDragging, ref } = useDraggable({
    id: `pill-${template.id}`,
    data: { type: 'quick-book-pill', template },
    disabled: !canBook,
    element: elementRef,
  })

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(isDragging ? { opacity: 0.4 } : {}),
    ...(!canBook ? DISABLED_OVERLAY : {}),
  }

  return (
    <button
      ref={(el) => {
        elementRef.current = el
        ref(el)
      }}
      type="button"
      disabled={!canBook}
      className={`${PILL_BASE} ${canBook ? 'cursor-grab hover:brightness-125 hover:scale-105' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
      style={mergedStyle}
      onClick={canBook ? () => onSelect(template.courses) : undefined}
    >
      {template.label}
    </button>
  )
}
