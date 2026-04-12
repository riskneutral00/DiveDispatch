'use client'

import { useDraggable } from '@dnd-kit/react'
import { useRef } from 'react'
import type { QuickBookTemplate } from '@/lib/booking/quick-book-templates'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { DISABLED_OVERLAY, QUICK_BOOK_PILL_CLASS } from '@/components/booking/quick-book-rail'
import { PILL_BASE } from '@/lib/constants/pill-shell'

interface DraggablePillProps {
  template: QuickBookTemplate
  canBook: boolean
  onSelect: (courses: CourseCode[]) => void
}

export function DraggablePill({ template, canBook, onSelect }: DraggablePillProps) {
  const elementRef = useRef<HTMLButtonElement | null>(null)

  const { isDragging, ref } = useDraggable({
    id: `pill-${template.id}`,
    data: { type: 'quick-book-pill', template },
    disabled: !canBook,
    element: elementRef,
  })

  const mergedStyle: React.CSSProperties = {
    ...(isDragging ? { opacity: 0.4 } : {}),
    ...(!canBook ? DISABLED_OVERLAY : {}),
  }

  return (
    <button /* design-ok: DnD draggable surface with grab cursor */
      ref={(el) => {
        elementRef.current = el
        ref(el)
      }}
      type="button"
      disabled={!canBook}
      className={`${PILL_BASE} glass-surface glass-surface-elevated ${QUICK_BOOK_PILL_CLASS} ${canBook ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
      style={mergedStyle}
      onClick={canBook ? () => onSelect(template.courses) : undefined}
    >
      {template.label}
    </button>
  )
}
