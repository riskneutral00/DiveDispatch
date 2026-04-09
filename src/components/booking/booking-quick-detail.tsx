'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, Button, ActionLink, StatusBadge, MetaField } from '@/components/ui'
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
  const tBooking = useTranslations('booking')
  const tCommon = useTranslations('common')
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
              <StatusBadge status={booking.status} size="md" />
              {booking.operatorName && (
                <span className="text-label text-secondary">
                  {tBooking('byOperator', { name: booking.operatorName })}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-body">
              <MetaField label={tBooking('dates')}>
                {booking.startDate}
                {booking.endDate !== booking.startDate && ` → ${booking.endDate}`}
              </MetaField>
              <MetaField label={tBooking('customers')}>
                {booking.diverCount}
              </MetaField>
              {booking.customerName && (
                <MetaField label={tBooking('leadCustomer')}>
                  {booking.customerName}
                </MetaField>
              )}
              {booking.instructorName && (
                <MetaField label={tBooking('instructor')}>
                  {booking.instructorName}
                </MetaField>
              )}
              {booking.boatName && (
                <MetaField label={tBooking('boat')}>
                  {booking.boatName}
                </MetaField>
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
                      {tCommon('accept')}
                    </Button>
                  )}
                  <ActionLink
                    onClick={handleViewDetail}
                    className="text-label"
                    disabled={isLoading}
                  >
                    {tBooking('viewFullDetail')}
                  </ActionLink>
                  {onDecline && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDecline(booking._id)}
                      loading={isDeclining}
                      disabled={isAccepting}
                    >
                      {tCommon('decline')}
                    </Button>
                  )}
                </>
              ) : (
                <Button size="sm" variant="primary" onClick={handleViewDetail}>
                  {tBooking('viewFullDetail')}
                </Button>
              )}
            </div>

            {error && (
              <p className="text-label text-center pt-1 text-destructive">
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
