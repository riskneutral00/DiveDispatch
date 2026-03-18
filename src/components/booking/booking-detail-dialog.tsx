'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { Edit2, Copy, Check, ExternalLink, Play, Trash2 } from 'lucide-react'
import { ConvexError } from 'convex/values'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BookingDetail } from '../../../convex/bookings'
import type { BookingLinkInfo } from '../../../convex/bookingLinks'
import { GlassButton, GlassBadge, GlassDialog } from '@/components/glass'
import { courseLabel } from '@/lib/constants/course-catalog'
import { CancelBookingDialog } from './cancel-booking-dialog'
import { ReservationStatusList } from './reservation-status-list'
import { SessionTimeline } from './session-timeline'

// ── Types ───────────────────────────────────────────────────────────────────

interface BookingDetailDialogProps {
  bookingId: string | null // null = closed
  onClose: () => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return start
  return `${start} – ${end}`
}

function statusVariant(
  status: BookingDetail['status'],
): 'success' | 'info' | 'warning' | 'destructive' | 'default' {
  switch (status) {
    case 'Draft':
      return 'warning'
    case 'Upcoming':
      return 'info'
    case 'Completed':
      return 'success'
    case 'Cancelled':
      return 'destructive'
    default:
      return 'default'
  }
}

function computeTTLLabel(expiresAt: number | undefined): string | null {
  if (!expiresAt) return null
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 'Expired'
  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}

function useTTLCountdown(expiresAt: number | undefined): string | null {
  const [label, setLabel] = useState<string | null>(() => computeTTLLabel(expiresAt))

  useEffect(() => {
    if (!expiresAt) return
    const interval = setInterval(() => setLabel(computeTTLLabel(expiresAt)), 60_000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return label
}

// ── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-wider mb-3"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </p>
  )
}

// ── Portal completion pills ──────────────────────────────────────────────────

interface PortalPill {
  label: string
  done: boolean
}

function PortalPills({ pills }: { pills: PortalPill[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {pills.map(({ label, done }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{
            background: done
              ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
              : 'var(--color-glass-bg)',
            color: done ? 'var(--color-success)' : 'var(--color-text-secondary)',
            border: `1px solid ${done ? 'color-mix(in srgb, var(--color-success) 30%, transparent)' : 'var(--color-glass-border)'}`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: done ? 'var(--color-success)' : 'var(--color-text-secondary)', opacity: done ? 1 : 0.4 }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}

// ── Portal link section ──────────────────────────────────────────────────────

function PortalLinkSection({
  bookingId,
  portalLink,
  divers,
}: {
  bookingId: string
  portalLink: BookingLinkInfo | null | undefined
  divers: BookingDetail['divers']
}) {
  const [copied, setCopied] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [customerName, setCustomerName] = useState(divers.length > 0 ? divers[0].name : '')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const createLink = useMutation(api.bookingLinks.create)

  const portalUrl = portalLink
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${portalLink.token}`
    : null

  async function handleCopy() {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      await createLink({
        bookingId: bookingId as Id<'bookings'>,
        customerName,
        email,
      })
      setShowCreateForm(false)
    } catch {
      setCreateError('Failed to generate link. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  if (portalLink) {
    return (
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 p-2.5 rounded-lg border text-xs font-mono break-all"
          style={{
            background: 'var(--color-glass-bg)',
            borderColor: 'var(--color-glass-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <ExternalLink size={12} className="flex-shrink-0" />
          <span className="flex-1 truncate">{portalUrl}</span>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </GlassButton>
          <GlassButton variant="ghost" size="sm" onClick={() => setShowCreateForm(true)}>
            Regenerate
          </GlassButton>
        </div>
      </div>
    )
  }

  if (showCreateForm) {
    return (
      <form onSubmit={handleCreate} className="space-y-3">
        <div>
          <label
            className="text-xs font-medium block mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Customer name
          </label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              background: 'var(--color-glass-bg)',
              borderColor: 'var(--color-glass-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
        <div>
          <label
            className="text-xs font-medium block mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Customer email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              background: 'var(--color-glass-bg)',
              borderColor: 'var(--color-glass-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
        {createError && (
          <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
            {createError}
          </p>
        )}
        <div className="flex gap-2">
          <GlassButton type="submit" variant="primary" size="sm" loading={creating}>
            Generate Link
          </GlassButton>
          <GlassButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateForm(false)}
          >
            Cancel
          </GlassButton>
        </div>
      </form>
    )
  }

  return (
    <GlassButton variant="secondary" size="sm" onClick={() => setShowCreateForm(true)}>
      <ExternalLink size={13} />
      Send Portal Link
    </GlassButton>
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
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string }
        setError(data.code === 'INVALID_STATUS' ? 'This booking is no longer a draft.' : 'Failed to discard. Please try again.')
      } else {
        setError('An unexpected error occurred.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
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
        <GlassButton variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
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
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Booking not found
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
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
    <div className="space-y-5">
      {/* Header: status + TTL + activity + date + divers */}
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
        <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {booking.activityType.map(courseLabel).join(', ')}
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {formatDateRange(booking.startDate, booking.endDate)} ·{' '}
          {booking.divers.length} {booking.divers.length === 1 ? 'diver' : 'divers'}
        </p>

        {/* Diver names with flags */}
        {booking.divers.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {booking.divers.map((diver, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span aria-label={diver.flag.label}>{flagEmoji(diver.flag.code)}</span>
                {diver.name}
              </span>
            ))}
          </div>
        )}
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
        <SectionLabel>Customer Portal</SectionLabel>
        <PortalPills pills={portalPills} />
        <div className="mt-3">
          <PortalLinkSection
            bookingId={bookingId}
            portalLink={portalLink ?? null}
            divers={booking.divers}
          />
        </div>
      </div>

      {/* Sessions */}
      {booking.sessions.length > 0 && (
        <div>
          <SectionLabel>Sessions</SectionLabel>
          <SessionTimeline sessions={booking.sessions} />
        </div>
      )}

      {/* Resources */}
      <div>
        <SectionLabel>Resources</SectionLabel>
        <ReservationStatusList reservations={booking.reservations} />
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
      size="xl"
      className="!max-w-2xl"
    >
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {bookingId !== null && (
          <BookingDetailContent bookingId={bookingId} onClose={onClose} />
        )}
      </div>
    </GlassDialog>
  )
}
