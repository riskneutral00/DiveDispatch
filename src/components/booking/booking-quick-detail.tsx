'use client'

import { useState } from 'react'
import { Dialog, Button, Badge, ActionLink } from '@/components/ui'
import { statusVariant } from '@/lib/booking/booking-display'
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
      <Dialog
        open={booking !== null && !showFullDetail}
        onClose={isLoading ? () => {} : onClose}
        title={booking?.activityType.map(courseLabel).join(', ') ?? ''}
        size="lg"
      >
        {booking && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(booking.status)} size="md">{booking.status}</Badge>
              {booking.operatorName && (
                <span className="text-label text-secondary">
                  by {booking.operatorName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-body">
              <div>
                <p
                  className="text-label font-semibold uppercase text-secondary"
                >
                  Dates
                </p>
                <p className="text-primary">
                  {booking.startDate}
                  {booking.endDate !== booking.startDate && ` → ${booking.endDate}`}
                </p>
              </div>
              <div>
                <p
                  className="text-label font-semibold uppercase text-secondary"
                >
                  Customers
                </p>
                <p className="text-primary">{booking.diverCount}</p>
              </div>
              {booking.customerName && (
                <div>
                  <p
                    className="text-label font-semibold uppercase text-secondary"
                  >
                    Lead Customer
                  </p>
                  <p className="text-primary">{booking.customerName}</p>
                </div>
              )}
              {booking.instructorName && (
                <div>
                  <p
                    className="text-label font-semibold uppercase text-secondary"
                  >
                    Instructor
                  </p>
                  <p className="text-primary">{booking.instructorName}</p>
                </div>
              )}
              {booking.boatName && (
                <div>
                  <p
                    className="text-label font-semibold uppercase text-secondary"
                  >
                    Boat
                  </p>
                  <p className="text-primary">{booking.boatName}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              {hasActions ? (
                <>
                  {onAccept && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onAccept(booking._id)}
                      loading={isAccepting}
                      disabled={isDeclining}
                    >
                      Accept
                    </Button>
                  )}
                  <ActionLink
                    onClick={handleViewDetail}
                    className="text-label"
                    disabled={isLoading}
                  >
                    View Full Detail
                  </ActionLink>
                  {onDecline && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDecline(booking._id)}
                      loading={isDeclining}
                      disabled={isAccepting}
                    >
                      Decline
                    </Button>
                  )}
                </>
              ) : (
                <Button size="sm" variant="primary" onClick={handleViewDetail}>
                  View Full Detail
                </Button>
              )}
            </div>

            {error && (
              <p className="text-label text-center pt-1 text-[var(--color-status-cancelled)]">
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>

      {booking && (
        <BookingDetailDialog
          bookingId={showFullDetail ? booking._id : null}
          onClose={handleFullDetailClose}
        />
      )}
    </>
  )
}
