'use client'

import { X } from 'lucide-react'
import { formatDateRangeCompact } from '@/lib/utils/date'

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

export function UrgentBookingStrip({
  bookings,
  onBookingClick,
  onCancel,
}: UrgentBookingStripProps) {
  const sorted = [...bookings].sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <div className="flex items-center justify-center gap-2 px-2">
      {sorted.map((b) => (
        <div
          key={b._id}
          className="urgent-pulse inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" /* design-ok */
          style={{
            background: 'var(--color-status-urgent)',
            color: 'var(--color-text-on-primary)',
            border: '1px solid var(--color-status-urgent-border)',
            boxShadow: '0 0 8px var(--color-destructive-glow)',
            lineHeight: '1.2',
          }}
        >
          <button /* design-ok: inline text link in compact strip */
            type="button"
            onClick={() => onBookingClick?.(b._id)}
            className="bg-transparent border-none p-0 font-inherit text-inherit cursor-pointer"
          >
            {formatDateRangeCompact(b.startDate, b.endDate)}
          </button>
          <button /* design-ok: compact dismiss X in notification strip */
            type="button"
            onClick={() => onCancel(b._id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onCancel(b._id)
              }
            }}
            className="inline-flex items-center justify-center rounded-full bg-transparent border-none p-0 cursor-pointer opacity-50 transition-opacity duration-theme hover:opacity-100"
            style={{ color: 'inherit' }}
            aria-label="Cancel urgent booking"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
