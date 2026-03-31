'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { Edit2, Play, Trash2 } from 'lucide-react'
import { getConvexErrorCode } from '@/lib/utils/convex-error'
import { DISCARD_DRAFT_ERROR_MESSAGE } from '@/lib/constants/error-messages'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassButton, GlassButtonGroup, GlassBadge, GlassDialog } from '@/components/ui'
import { courseLabel } from '@/lib/constants/course-catalog'
import { formatDateRange, statusVariant } from '@/lib/booking/booking-display'
import {
  useTTLCountdown,
  CustomerTable,
  StakeholderList,
  PortalLinkSection,
  PortalPills,
  type PortalPill,
} from './booking-detail-shared'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { CancelBookingDialog } from './cancel-booking-dialog'
import { ReservationStatusList } from './reservation-status-list'
import { SessionTimeline } from './session-timeline'
import { AuditTrailTable } from './audit-trail-table'

// ── Types ───────────────────────────────────────────────────────────────────

interface BookingDetailDialogProps {
  bookingId: string | null // null = closed
  onClose: () => void
}

// ── Section tabs ─────────────────────────────────────────────────────────────

type SectionId = 'overview' | 'customers' | 'schedule' | 'resources' | 'reservations' | 'audit'

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'customers', label: 'Customers' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'resources', label: 'Resources' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'audit', label: 'Audit Trail' },
]

function SectionTabs({
  active,
  onChange,
}: {
  active: SectionId
  onChange: (id: SectionId) => void
}) {
  return (
    <GlassButtonGroup
      variant="tabs"
      value={active}
      onChange={(v) => onChange(v as SectionId)}
      options={SECTIONS.map(({ id, label }) => ({ value: id, label }))}
      aria-label="Booking sections"
    />
  )
}

// ── Discard draft confirmation ───────────────────────────────────────────────

function DiscardDraftDialog({
  open,
  onClose,
  bookingId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  onSuccess: () => void
}) {
  const discardDraft = useMutation(api.bookingDraftMutations.discardDraft)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDiscard() {
    setError(null)
    setSubmitting(true)
    try {
      await discardDraft({ bookingId: bookingId as Id<'bookings'> })
      onSuccess()
      onClose()
    } catch (err) {
      const code = getConvexErrorCode(err)
      setError(code === 'INVALID_STATUS' ? 'This booking is no longer a draft.' : DISCARD_DRAFT_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    if (submitting) return
    setError(null)
    onClose()
  }

  return (
    <GlassDialog
      open={open}
      onClose={handleClose}
      title="Discard draft?"
      description="This will permanently delete the draft and release all resource holds."
      size="sm"
    >
      {error && (
        <p className="text-sm mb-3" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <GlassButton variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
          Keep draft
        </GlassButton>
        <GlassButton variant="destructive" size="sm" onClick={handleDiscard} loading={submitting}>
          Discard
        </GlassButton>
      </div>
    </GlassDialog>
  )
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 rounded w-1/3" style={{ background: 'var(--color-glass-border)' }} />
          <div className="h-3 rounded w-2/3" style={{ background: 'var(--color-glass-border)' }} />
        </div>
      ))}
    </div>
  )
}

// ── Dialog content ───────────────────────────────────────────────────────────

function BookingDetailContent({
  bookingId,
  onClose,
}: {
  bookingId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>('overview')

  const booking = useQuery(api.bookings.getBookingDetail, {
    bookingId: bookingId as Id<'bookings'>,
  })

  const portalLink = useQuery(
    api.bookingLinks.getByBookingId,
    booking != null ? { bookingId: bookingId as Id<'bookings'> } : 'skip',
  )

  const ttlLabel = useTTLCountdown(booking?.status === 'Draft' ? booking.expiresAt : undefined)

  if (booking === undefined) return <LoadingSkeleton />

  if (booking === null) {
    return (
      <div className="text-center py-4">
        <p className="text-sm font-semibold mb-1 text-primary">
          Booking not found
        </p>
        <p className="text-xs text-secondary">
          This booking does not exist or you do not have access.
        </p>
      </div>
    )
  }

  const isDraft = booking.status === 'Draft'
  const canEdit = booking.status !== 'Cancelled' && booking.status !== 'Completed'
  const canCancel = booking.status !== 'Cancelled'

  // Equipment: all profiles submitted
  const equipmentDone =
    booking.customerProfiles.length > 0 &&
    booking.customerProfiles.every((p) => p.submittedAt != null)

  const portalPills: PortalPill[] = [
    { label: 'Contact', done: booking.portalContact },
    { label: 'Medical', done: booking.portalMedical },
    { label: 'Waiver', done: booking.portalWaiver },
    { label: 'Equipment', done: equipmentDone },
    { label: 'Payment', done: false },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Section navigation tabs */}
      <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
        <SectionTabs active={activeSection} onChange={setActiveSection} />
      </div>

      {/* Scrollable section content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">

        {/* ── Overview ─────────────────────────────────────────────────── */}
        {activeSection === 'overview' && (
          <>
            {/* Status + summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <GlassBadge variant={statusVariant(booking.status)} dot>
                  {booking.status}
                </GlassBadge>
                {isDraft && ttlLabel && (
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
              <p className="text-base font-semibold text-primary">
                {booking.activityType.map(courseLabel).join(', ')}
              </p>
              <p className="text-sm text-secondary">
                {formatDateRange(booking.startDate, booking.endDate)} ·{' '}
                {booking.divers.length} {booking.divers.length === 1 ? 'diver' : 'divers'}
              </p>
              <p className="text-xs text-secondary">
                Operator: {booking.operatorName}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <>
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      router.push(`/booking/${bookingId}/edit`)
                      onClose()
                    }}
                  >
                    <Play size={13} />
                    Resume
                  </GlassButton>
                  <GlassButton
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDiscardDialog(true)}
                  >
                    <Trash2 size={13} />
                    Discard
                  </GlassButton>
                </>
              ) : (
                canEdit && (
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      router.push(`/booking/${bookingId}/edit`)
                      onClose()
                    }}
                  >
                    <Edit2 size={13} />
                    Edit Booking
                  </GlassButton>
                )
              )}
              {canCancel && !isDraft && (
                <GlassButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel Booking
                </GlassButton>
              )}
            </div>

            {/* Portal completion pills */}
            <div>
              <FormSectionHeader label="Customer Portal" />
              <PortalPills pills={portalPills} />
              <div className="mt-3">
                <PortalLinkSection
                  bookingId={bookingId}
                  portalLink={portalLink ?? null}
                  divers={booking.divers}
                  compact
                />
              </div>
            </div>
          </>
        )}

        {/* ── Customers ────────────────────────────────────────────────── */}
        {activeSection === 'customers' && (
          <div>
            <FormSectionHeader label="Customers" />
            <CustomerTable booking={booking} compact />
          </div>
        )}

        {/* ── Schedule ─────────────────────────────────────────────────── */}
        {activeSection === 'schedule' && (
          <div>
            <FormSectionHeader label="Session Schedule" />
            {booking.sessions.length === 0 ? (
              <p className="text-sm text-secondary">
                No sessions scheduled.
              </p>
            ) : (
              <SessionTimeline sessions={booking.sessions} />
            )}
          </div>
        )}

        {/* ── Resources ────────────────────────────────────────────────── */}
        {activeSection === 'resources' && (
          <div>
            <FormSectionHeader label="Stakeholders" />
            <StakeholderList stakeholders={booking.stakeholders} compact />
          </div>
        )}

        {/* ── Reservations ─────────────────────────────────────────────── */}
        {activeSection === 'reservations' && (
          <div>
            <FormSectionHeader label="Reservations" />
            <ReservationStatusList reservations={booking.reservations} />
          </div>
        )}

        {/* ── Audit Trail ──────────────────────────────────────────────── */}
        {activeSection === 'audit' && (
          <div>
            <FormSectionHeader label="Audit Trail" />
            <AuditTrailTable bookingId={bookingId} />
          </div>
        )}
      </div>

      {/* Cancel dialog */}
      <CancelBookingDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        bookingId={bookingId as Id<'bookings'>}
        onSuccess={onClose}
      />

      {/* Discard dialog */}
      {showDiscardDialog && (
        <DiscardDraftDialog
          open={showDiscardDialog}
          onClose={() => setShowDiscardDialog(false)}
          bookingId={bookingId}
          onSuccess={onClose}
        />
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function BookingDetailDialog({ bookingId, onClose }: BookingDetailDialogProps) {
  return (
    <GlassDialog
      open={bookingId !== null}
      onClose={onClose}
      title="Booking Detail"
      fullScreen
    >
      {bookingId !== null && (
        <BookingDetailContent bookingId={bookingId} onClose={onClose} />
      )}
    </GlassDialog>
  )
}
