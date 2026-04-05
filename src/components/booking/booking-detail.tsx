'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { ArrowLeft, Edit2, ShieldCheck, X } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Card, Button, Badge } from '@/components/ui'
import { courseLabel } from '@/lib/constants/course-catalog'
import { formatDateRange, statusVariant } from '@/lib/booking/booking-display'
import {
  useTTLCountdown,
  CustomerTable,
  StakeholderList,
  PortalLinkSection,
} from './booking-detail-shared'
import { SendPortalLink } from './send-portal-link'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { CancelBookingDialog } from './cancel-booking-dialog'
import { ReservationStatusList } from './reservation-status-list'
import { SessionTimeline } from './session-timeline'
import { PortalProgressCard } from './portal-progress-card'
import { AuditTrailTable } from './audit-trail-table'
import { ROLES } from '@/lib/constants/roles'

const OPERATOR_CLERK_ROLES = new Set(
  ROLES.filter((r) => r.isOrganizer).map((r) => r.clerkRole),
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface BookingDetailProps {
  bookingId: string
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} padding="md">
          <div className="animate-pulse space-y-3">
            <div className="h-4 rounded w-1/3" style={{ background: 'var(--color-glass-border)' }} />
            <div className="h-3 rounded w-2/3" style={{ background: 'var(--color-glass-border)' }} />
            <div className="h-3 rounded w-1/2" style={{ background: 'var(--color-glass-border)' }} />
          </div>
        </Card>
      ))}
    </div>
  )
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

  if (booking === undefined) return <LoadingSkeleton />

  if (booking === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card padding="lg" className="max-w-sm w-full text-center">
          <p
            className="text-lg font-semibold mb-2 text-primary"
          >
            Booking not found
          </p>
          <p className="text-sm mb-4 text-secondary">
            This booking does not exist or you do not have access.
          </p>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  const canEdit = booking.status !== 'Cancelled'
  const canCancel = booking.status !== 'Cancelled'
  const isOperator = (userRoles ?? []).some((r) => OPERATOR_CLERK_ROLES.has(r.role))
  const canClearMedical = booking.medicalHardBlock && isOperator

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg transition-colors text-secondary"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold text-primary">
          Booking Detail
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

      {/* Customers */}
      {booking.divers.length > 0 && (
        <Card padding="md">
          <FormSectionHeader label="Customers" />
          <CustomerTable booking={booking} />
        </Card>
      )}

      {/* Sessions */}
      {booking.sessions.length > 0 && (
        <Card padding="md">
          <FormSectionHeader label="Schedule" />
          <SessionTimeline sessions={booking.sessions} />
        </Card>
      )}

      {/* Stakeholders */}
      <Card padding="md">
        <FormSectionHeader label="Stakeholders" />
        <StakeholderList stakeholders={booking.stakeholders} />
      </Card>

      {/* Reservations */}
      <Card padding="md">
        <FormSectionHeader label="Reservations" />
        <ReservationStatusList reservations={booking.reservations} />
      </Card>

      {/* Portal progress */}
      <Card padding="md">
        <FormSectionHeader label="Customer Portal" />
        <PortalProgressCard
          portalContact={booking.portalContact}
          portalMedical={booking.portalMedical}
          portalWaiver={booking.portalWaiver}
          customerFormComplete={booking.customerFormComplete}
          customerProfiles={booking.customerProfiles}
        />
        <div className="mt-4 pt-3 space-y-3" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
          {portalLink && (
            <PortalLinkSection
              bookingId={bookingId}
              portalLink={portalLink}
              divers={booking.divers}
            />
          )}
          {booking.divers.length > 0 && (
            <SendPortalLink
              bookingId={bookingId as Id<'bookings'>}
              customerName={booking.divers[0].name}
              email={booking.divers[0].contactType === 'email' ? (booking.divers[0].contactValue ?? '') : (portalLink?.email ?? '')}
              operatorName={booking.operatorName}
              contactType={booking.divers[0].contactType}
              contactValue={booking.divers[0].contactValue}
            />
          )}
        </div>
      </Card>

      {/* Audit trail */}
      <Card padding="md">
        <FormSectionHeader label="Audit Trail" />
        <AuditTrailTable bookingId={bookingId} />
      </Card>

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
