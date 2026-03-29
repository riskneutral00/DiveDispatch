'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { ArrowLeft, Edit2, ShieldCheck, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassCard, GlassButton, GlassBadge, GlassDialog } from '@/components/glass'
import { courseLabel } from '@/lib/constants/course-catalog'
import { formatDateRange, statusVariant } from '@/lib/booking/booking-display'
import {
  useTTLCountdown,
  CustomerTable,
  StakeholderList,
  PortalLinkSection,
} from './booking-detail-shared'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { CANCEL_BOOKING_ERROR_MESSAGE } from '@/lib/constants/error-messages'
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
        <GlassCard key={i} padding="md">
          <div className="animate-pulse space-y-3">
            <div className="h-4 rounded w-1/3" style={{ background: 'var(--color-glass-border)' }} />
            <div className="h-3 rounded w-2/3" style={{ background: 'var(--color-glass-border)' }} />
            <div className="h-3 rounded w-1/2" style={{ background: 'var(--color-glass-border)' }} />
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BookingDetail({ bookingId }: BookingDetailProps) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const booking = useQuery(api.bookings.getBookingDetail, {
    bookingId: bookingId as Id<'bookings'>,
  })

  const portalLink = useQuery(
    api.bookingLinks.getByBookingId,
    booking != null ? { bookingId: bookingId as Id<'bookings'> } : 'skip',
  )

  const userRoles = useQuery(api.userRoles.myRoles)

  const cancelBooking = useMutation(api.bookings.status.cancelBooking)
  const clearMedicalBlock = useMutation(api.bookings.status.clearMedicalBlock)

  const ttlLabel = useTTLCountdown(
    booking?.status === 'Draft' ? booking.expiresAt : undefined,
  )

  if (booking === undefined) return <LoadingSkeleton />

  if (booking === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <GlassCard padding="lg" className="max-w-sm w-full text-center">
          <p
            className="text-lg font-semibold mb-2 text-primary"
          >
            Booking not found
          </p>
          <p className="text-sm mb-4 text-secondary">
            This booking does not exist or you do not have access.
          </p>
          <GlassButton variant="secondary" onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </GlassButton>
        </GlassCard>
      </div>
    )
  }

  const canEdit = booking.status !== 'Cancelled'
  const canCancel = booking.status !== 'Cancelled'
  const isOperator = (userRoles ?? []).some((r) => OPERATOR_CLERK_ROLES.has(r.role))
  const canClearMedical = booking.medicalHardBlock && isOperator

  async function handleCancel() {
    setCancelError(null)
    setCancelling(true)
    try {
      await cancelBooking({ bookingId: bookingId as Id<'bookings'> })
      setShowCancelDialog(false)
      router.push('/dashboard')
    } catch {
      setCancelError(CANCEL_BOOKING_ERROR_MESSAGE)
    } finally {
      setCancelling(false)
    }
  }

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
      <GlassCard padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <GlassBadge variant={statusVariant(booking.status)} dot>
                {booking.status}
              </GlassBadge>
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
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/booking/${bookingId}/edit`)}
              >
                <Edit2 size={14} />
                Edit
              </GlassButton>
            )}
            {canClearMedical && (
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => clearMedicalBlock({ bookingId: bookingId as Id<'bookings'> })}
              >
                <ShieldCheck size={14} />
                Clear Medical Block
              </GlassButton>
            )}
            {canCancel && (
              <GlassButton
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
              >
                <X size={14} />
                Cancel
              </GlassButton>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Customers */}
      {booking.divers.length > 0 && (
        <GlassCard padding="md">
          <FormSectionHeader label="Customers" />
          <CustomerTable booking={booking} />
        </GlassCard>
      )}

      {/* Sessions */}
      {booking.sessions.length > 0 && (
        <GlassCard padding="md">
          <FormSectionHeader label="Schedule" />
          <SessionTimeline sessions={booking.sessions} />
        </GlassCard>
      )}

      {/* Stakeholders */}
      <GlassCard padding="md">
        <FormSectionHeader label="Stakeholders" />
        <StakeholderList stakeholders={booking.stakeholders} />
      </GlassCard>

      {/* Reservations */}
      <GlassCard padding="md">
        <FormSectionHeader label="Reservations" />
        <ReservationStatusList reservations={booking.reservations} />
      </GlassCard>

      {/* Portal progress */}
      <GlassCard padding="md">
        <FormSectionHeader label="Customer Portal" />
        <PortalProgressCard
          portalContact={booking.portalContact}
          portalMedical={booking.portalMedical}
          portalWaiver={booking.portalWaiver}
          customerFormComplete={booking.customerFormComplete}
          customerProfiles={booking.customerProfiles}
        />
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
          <PortalLinkSection
            bookingId={bookingId}
            portalLink={portalLink ?? null}
            divers={booking.divers}
          />
        </div>
      </GlassCard>

      {/* Audit trail */}
      <GlassCard padding="md">
        <FormSectionHeader label="Audit Trail" />
        <AuditTrailTable bookingId={bookingId} />
      </GlassCard>

      {/* Cancel dialog */}
      <GlassDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        title="Cancel booking?"
        description="This will vacate all resource reservations and cannot be undone."
        size="sm"
      >
        <div className="p-4 sm:p-6 space-y-4">
          {cancelError && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
              {cancelError}
            </p>
          )}
          <div className="flex gap-3">
            <GlassButton
              variant="destructive"
              size="md"
              fullWidth
              loading={cancelling}
              onClick={handleCancel}
            >
              Yes, cancel booking
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setShowCancelDialog(false)}
            >
              Keep booking
            </GlassButton>
          </div>
        </div>
      </GlassDialog>
    </div>
  )
}
