'use client'

import { QUICK_BOOK_PILL_CLASS } from '@/components/booking/quick-book-rail'

interface DragOverlayPillProps {
  label: string
}

const OVERLAY_ENHANCEMENTS: React.CSSProperties = {
  boxShadow: '0 8px 24px var(--color-glass-shadow-elevated)',
  opacity: 0.9,
  transform: 'scale(1.05)',
  pointerEvents: 'none',
}

export function DragOverlayPill({ label }: DragOverlayPillProps) {
  return (
    <div
      className={`rounded-full px-3 py-1 font-medium select-none glass-surface glass-surface-elevated ${QUICK_BOOK_PILL_CLASS}`}
      style={OVERLAY_ENHANCEMENTS}
    >
      {label}
    </div>
  )
}
