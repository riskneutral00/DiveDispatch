'use client'

import { GlassDialog, GlassButton } from '@/components/glass'
import { BookingStatusBadge } from '@/components/glass/booking-status-badge'
import { courseLabel } from '@/lib/constants/course-catalog'
import type { CalendarBooking } from '../../../convex/bookings'

interface BookingQuickDetailProps {
  booking: CalendarBooking | null
  onClose: () => void
}

export function BookingQuickDetail({ booking, onClose }: BookingQuickDetailProps) {
  return (
    <GlassDialog
      open={booking !== null}
      onClose={onClose}
      title={booking?.activityType.map(courseLabel).join(', ') ?? ''}
      size="lg"
    >
      {booking && (
        <div className="space-y-4">
          <BookingStatusBadge status={booking.status} size="md" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p
                className="text-xs font-semibold uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Dates
              </p>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {booking.startDate}
                {booking.endDate !== booking.startDate && ` → ${booking.endDate}`}
              </p>
            </div>
            <div>
              <p
                className="text-xs font-semibold uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Divers
              </p>
              <p style={{ color: 'var(--color-text-primary)' }}>{booking.diverCount}</p>
            </div>
            {booking.customerName && (
              <div>
                <p
                  className="text-xs font-semibold uppercase"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Lead Diver
                </p>
                <p style={{ color: 'var(--color-text-primary)' }}>{booking.customerName}</p>
              </div>
            )}
            {booking.instructorName && (
              <div>
                <p
                  className="text-xs font-semibold uppercase"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Instructor
                </p>
                <p style={{ color: 'var(--color-text-primary)' }}>{booking.instructorName}</p>
              </div>
            )}
            {booking.boatName && (
              <div>
                <p
                  className="text-xs font-semibold uppercase"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Boat
                </p>
                <p style={{ color: 'var(--color-text-primary)' }}>{booking.boatName}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <GlassButton size="sm" variant="secondary" onClick={onClose}>
              Close
            </GlassButton>
          </div>
        </div>
      )}
    </GlassDialog>
  )
}
