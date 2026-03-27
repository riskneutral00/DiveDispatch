'use client'

import { PILL_STYLE, ACCENT_PILL_STYLE } from '@/components/booking/quick-book-rail'

interface DragOverlayPillProps {
  label: string
  isAccent?: boolean
}

const OVERLAY_ENHANCEMENTS: React.CSSProperties = {
  boxShadow: '0 8px 24px var(--color-glass-shadow-elevated)',
  opacity: 0.9,
  transform: 'scale(1.05)',
  pointerEvents: 'none',
}

export function DragOverlayPill({ label, isAccent }: DragOverlayPillProps) {
  const baseStyle = isAccent ? ACCENT_PILL_STYLE : PILL_STYLE

  return (
    <div
      className="rounded-full px-3 py-1 font-medium select-none"
      style={{ ...baseStyle, ...OVERLAY_ENHANCEMENTS }}
    >
      {label}
    </div>
  )
}
