'use client'

import { useState } from 'react'
import { GlassDialog, GlassButton } from '@/components/glass'
import { BookingStatusBadge } from '@/components/glass/booking-status-badge'
import { courseLabel } from '@/lib/constants/course-catalog'
import type { CalendarBooking } from '../../../convex/bookings'
import { BookingDetailDialog } from './booking-detail-dialog'

interface BookingQuickDetailProps {
  booking: CalendarBooking | null
  onClose: () => void
  onAccept?: (bookingId: string) => void
  onDecline?: (bookingId: string) => void
  isAccepting?: boolean
  isDeclining?: boolean
  error?: string | null
}

export function BookingQuickDetail({
  booking,
  onClose,
  onAccept,
  onDecline,
  isAccepting = false,
  isDeclining = false,
  error = null,
}: BookingQuickDetailProps) {
  const [showFullDetail, setShowFullDetail] = useState(false)

  function handleViewDetail() {
    setShowFullDetail(true)
  }

  function handleFullDetailClose() {
    setShowFullDetail(false)
    onClose()
  }

  const hasActions = !!onAccept || !!onDecline
  const isLoading = isAccepting || isDeclining

  return (
    <>
      <GlassDialog
        open={booking !== null && !showFullDetail}
        onClose={isLoading ? () => {} : onClose}
        title={booking?.activityType.map(courseLabel).join(', ') ?? ''}
        size="lg"
      >
        {booking && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookingStatusBadge status={booking.status} size="md" />
              {booking.operatorName && (
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  by {booking.operatorName}
                </span>
              )}
            </div>

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
                  Customers
                </p>
                <p style={{ color: 'var(--color-text-primary)' }}>{booking.diverCount}</p>
              </div>
              {booking.customerName && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Lead Customer
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

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              {hasActions ? (
                <>
                  {onAccept && (
                    <GlassButton
                      size="sm"
                      variant="primary"
                      onClick={() => onAccept(booking._id)}
                      loading={isAccepting}
                      disabled={isDeclining}
                    >
                      Accept
                    </GlassButton>
                  )}
                  <button
                    type="button"
                    onClick={handleViewDetail}
                    className="text-xs underline underline-offset-4 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--color-text-secondary)' }}
                    disabled={isLoading}
                  >
                    View Full Detail
                  </button>
                  {onDecline && (
                    <GlassButton
                      size="sm"
                      variant="destructive"
                      onClick={() => onDecline(booking._id)}
                      loading={isDeclining}
                      disabled={isAccepting}
                    >
                      Decline
                    </GlassButton>
                  )}
                </>
              ) : (
                <GlassButton size="sm" variant="primary" onClick={handleViewDetail}>
                  View Full Detail
                </GlassButton>
              )}
            </div>

            {error && (
              <p className="text-xs text-center pt-1" style={{ color: 'var(--color-status-cancelled)' }}>
                {error}
              </p>
            )}
          </div>
        )}
      </GlassDialog>

      {booking && (
        <BookingDetailDialog
          bookingId={showFullDetail ? booking._id : null}
          onClose={handleFullDetailClose}
        />
      )}
    </>
  )
}
