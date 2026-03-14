'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { ArrowLeft, Edit2, X, ExternalLink, Copy, Check } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BookingDetail } from '../../../convex/bookings'
import type { BookingLinkInfo } from '../../../convex/bookingLinks'
import { GlassCard, GlassButton, GlassBadge, GlassDialog } from '@/components/glass'
import { ReservationStatusList } from './reservation-status-list'
import { SessionTimeline } from './session-timeline'
import { PortalProgressCard } from './portal-progress-card'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BookingDetailProps {
  bookingId: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Section heading ────────────────────────────────────────────────────────────

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

// ── Portal link section ────────────────────────────────────────────────────────

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
  const [customerName, setCustomerName] = useState(
    divers.length > 0 ? divers[0].name : '',
  )
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
    const isExpired = portalLink.expiresAt < Date.now()
    return (
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 p-3 rounded-lg border text-sm font-mono break-all"
          style={{
            background: 'var(--color-glass-bg)',
            borderColor: 'var(--color-glass-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <ExternalLink size={14} className="flex-shrink-0" />
          <span className="flex-1">{portalUrl}</span>
        </div>
        {isExpired && (
          <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
            This link has expired.
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <GlassButton variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
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
      <ExternalLink size={14} />
      Send Portal Link
    </GlassButton>
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

  const cancelBooking = useMutation(api.bookingsMutations.cancelBooking)

  const ttlLabel = useTTLCountdown(
    booking?.status === 'Draft' ? booking.expiresAt : undefined,
  )

  if (booking === undefined) return <LoadingSkeleton />

  if (booking === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <GlassCard padding="lg" className="max-w-sm w-full text-center">
          <p
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Booking not found
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
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

  const canEdit = booking.status === 'Draft' || booking.status === 'Upcoming'
  const canCancel = booking.status !== 'Cancelled'

  async function handleCancel() {
    setCancelError(null)
    setCancelling(true)
    try {
      await cancelBooking({ bookingId: bookingId as Id<'bookings'> })
      setShowCancelDialog(false)
      router.push('/dashboard')
    } catch {
      setCancelError('Failed to cancel booking. Please try again.')
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
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
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
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-text-primary)' }}>
              {booking.activityType.join(', ')}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
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

      {/* Sessions */}
      {booking.sessions.length > 0 && (
        <GlassCard padding="md">
          <SectionLabel>Sessions</SectionLabel>
          <SessionTimeline sessions={booking.sessions} />
        </GlassCard>
      )}

      {/* Reservations */}
      <GlassCard padding="md">
        <SectionLabel>Resources</SectionLabel>
        <ReservationStatusList reservations={booking.reservations} />
      </GlassCard>

      {/* Portal progress */}
      <GlassCard padding="md">
        <SectionLabel>Customer Portal</SectionLabel>
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
