'use client'

import { X } from 'lucide-react'
import { parseDateLocal } from '@/lib/utils/date'

interface UrgentBooking {
  _id: string
  startDate: string
  endDate: string
}

interface UrgentBookingStripProps {
  bookings: UrgentBooking[]
  onBookingClick?: (id: string) => void
  onCancel: (id: string) => void
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDateLocal(startDate)
  const end = parseDateLocal(endDate)
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (startDate === endDate) return startLabel
  // Same month — collapse
  if (start.getMonth() === end.getMonth()) {
    return `${startLabel}\u2013${end.getDate()}`
  }
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel}\u2013${endLabel}`
}

export function UrgentBookingStrip({
  bookings,
  onBookingClick,
  onCancel,
}: UrgentBookingStripProps) {
  const sorted = [...bookings].sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <div className="flex items-center justify-center gap-2 px-2">
      {sorted.map((b) => (
        <button
          key={b._id}
          type="button"
          onClick={() => onBookingClick?.(b._id)}
          className="urgent-pulse inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-80" /* design-ok */
          style={{
            background: 'var(--color-status-urgent)',
            color: 'var(--color-text-on-primary)',
            border: '1px solid var(--color-status-urgent-border)',
            boxShadow: '0 0 8px var(--color-destructive-glow)',
            lineHeight: '1.2',
          }}
        >
          {formatDateRange(b.startDate, b.endDate)}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onCancel(b._id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                e.preventDefault()
                onCancel(b._id)
              }
            }}
            className="inline-flex items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
            aria-label="Cancel urgent booking"
          >
            <X size={12} />
          </span>
        </button>
      ))}
    </div>
  )
}
