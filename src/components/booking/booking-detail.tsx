'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { ArrowLeft, Edit2, ShieldCheck, X } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Card, Button, Badge, EmptyState } from '@/components/ui'
import { courseLabel } from '@/lib/constants/course-catalog'
import { formatDateRange, statusVariant } from '@/lib/booking/booking-display'
import { TERMINAL_STATUSES, type CalendarDisplayStatus } from '@/lib/constants/status-colors'
import {
  useTTLCountdown,
  BookingDetailSkeleton,
  BookingDetailBody,
} from './booking-detail-shared'
import { CancelBookingDialog } from './cancel-booking-dialog'
import { ROLES } from '@/lib/constants/roles'

const OPERATOR_CLERK_ROLES = new Set(
  ROLES.filter((r) => r.isOrganizer).map((r) => r.clerkRole),
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface BookingDetailProps {
  bookingId: string
}

// ── Main component ─────────────────────────────────────────────────────────────

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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <EmptyState message="Booking not found or you don't have access." />
        <Button variant="secondary" onClick={() => router.push('/dashboard')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const canEdit = !TERMINAL_STATUSES.has(booking.status as CalendarDisplayStatus)
  const canCancel = !TERMINAL_STATUSES.has(booking.status as CalendarDisplayStatus)
  const isOperator = (userRoles ?? []).some((r) => OPERATOR_CLERK_ROLES.has(r.role))
  const canClearMedical = booking.medicalHardBlock && isOperator

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.back()}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[var(--border-radius-button)] transition-colors text-secondary"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold text-primary">
          Booking Details
        </h1>
      </div>

      {/* Status card */}
      <Card padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant(booking.status)} dot>
                {booking.status}
              </Badge>
              {booking.status === 'Draft' && ttlLabel && (
                <span
                  className="text-xs"
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
            <p className="text-sm font-medium mt-1 text-primary">
              {booking.activityType.map(courseLabel).join(', ')}
            </p>
            <p className="text-sm text-secondary">
              {formatDateRange(booking.startDate, booking.endDate)} ·{' '}
              {booking.divers.length} {booking.divers.length === 1 ? 'diver' : 'divers'}
            </p>
          </div>

          {/* Action buttons */}
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

      {/* Shared section body */}
      <BookingDetailBody
        booking={booking}
        bookingId={bookingId}
        portalLink={portalLink}
        layout="page"
      />

      {/* Cancel dialog */}
      <CancelBookingDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        bookingId={bookingId as Id<'bookings'>}
        onSuccess={() => router.push('/dashboard')}
      />
    </div>
  )
}
