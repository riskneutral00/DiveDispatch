'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { ArrowLeft, Edit2, ShieldCheck, X } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Card, Button, IconButton, NotFoundCard, PageTitle, StatusBadge } from '@/components/ui'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { courseLabel } from '@/lib/constants/course-catalog'
import { formatDateRange } from '@/lib/booking/booking-display'
import { TERMINAL_STATUSES, type CalendarDisplayStatus } from '@/lib/constants/status-colors'
import {
  useTTLCountdown,
  BookingDetailSkeleton,
  BookingDetailBody,
} from './booking-detail-shared'
import { CancelBookingDialog } from './cancel-booking-dialog'
import { ORGANIZER_ROLE_KEYS } from '@/lib/constants/roles'

interface BookingDetailProps {
  bookingId: string
}

export function BookingDetail({ bookingId }: BookingDetailProps) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const booking = useQuery(api.bookings.getBookingDetail, {
    bookingId: bookingId as Id<'bookings'>,
  })

  const portalLink = useQuery(
    api.bookingLinks.getByBookingId,
    booking != null ? { bookingId: bookingId as Id<'bookings'> } : 'skip',
  )

  const userRoles = useQuery(api.userRoles.myRoles)

  const clearMedicalBlock = useMutation(api.bookings.status.clearMedicalBlock)

  const ttlLabel = useTTLCountdown(
    booking?.status === 'Draft' ? booking.expiresAt : undefined,
  )

  if (booking === undefined) return <BookingDetailSkeleton />

  if (booking === null) {
    return (
      <NotFoundCard
        href="/dashboard"
        linkText="Back to Dashboard"
        message="Booking not found or you don't have access."
        size="md"
      />
    )
  }

  const canEdit = !TERMINAL_STATUSES.has(booking.status as CalendarDisplayStatus)
  const canCancel = !TERMINAL_STATUSES.has(booking.status as CalendarDisplayStatus)
  const isOperator = (userRoles ?? []).some((r) => ORGANIZER_ROLE_KEYS.has(r.role))
  const canClearMedical = booking.medicalHardBlock && isOperator

  return (
    <DashboardPageFrame className="min-h-screen p-4 md:p-6 space-y-4">

      <PageTitle
        title="Booking Details"
        leading={
          <IconButton variant="ghost" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft size={20} />
          </IconButton>
        }
      />

      <Card padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={booking.status} dot />
              {booking.status === 'Draft' && ttlLabel && (
                <span
                  className="text-label"
                  style={{
                    color:
                      ttlLabel === 'Expired'
                        ? 'var(--color-destructive)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {ttlLabel}
                </span>
              )}
            </div>
            <p className="text-body font-medium mt-1 text-primary">
              {booking.activityType.map(courseLabel).join(', ')}
            </p>
            <p className="text-body text-secondary">
              {formatDateRange(booking.startDate, booking.endDate)} ·{' '}
              {booking.divers.length} {booking.divers.length === 1 ? 'diver' : 'divers'}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/booking/${bookingId}/edit`)}
              >
                <Edit2 size={14} />
                Edit
              </Button>
            )}
            {canClearMedical && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => clearMedicalBlock({ bookingId: bookingId as Id<'bookings'> })}
              >
                <ShieldCheck size={14} />
                Clear Medical Block
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
              >
                <X size={14} />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      <BookingDetailBody
        booking={booking}
        bookingId={bookingId}
        portalLink={portalLink}
        layout="page"
      />

      <CancelBookingDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        bookingId={bookingId as Id<'bookings'>}
        onSuccess={() => router.push('/dashboard')}
      />
    </DashboardPageFrame>
  )
}
