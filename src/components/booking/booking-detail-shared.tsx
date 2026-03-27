'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BookingDetail, BookingDetailStakeholder } from '../../../convex/bookings'
import type { BookingLinkInfo } from '../../../convex/bookingLinks'
import { GlassButton, GlassBadge, RoleIcon } from '@/components/glass'
import type { ClerkRole } from '@/lib/constants/roles'
import { courseLabel } from '@/lib/constants/course-catalog'
import { computeTTLLabel, reservationVariant } from '@/lib/booking/booking-display'

// ── TTL countdown hook ──────────────────────────────────────────────────────

export function useTTLCountdown(expiresAt: number | undefined): string | null {
  const [label, setLabel] = useState<string | null>(() => computeTTLLabel(expiresAt))

  useEffect(() => {
    if (!expiresAt) return
    const interval = setInterval(() => setLabel(computeTTLLabel(expiresAt)), 60_000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return label
}

// ── Portal completion pills ──────────────────────────────────────────────────

export interface PortalPill {
  label: string
  done: boolean
}

export function PortalPills({ pills }: { pills: PortalPill[] }) {
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

// ── Section heading ─────────────────────────────────────────────────────────

import { FormSectionHeader } from '@/components/common/form-section-header'

/** @deprecated Use FormSectionHeader directly. Re-exported for backward compat. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <FormSectionHeader label={children} />
}

// ── Customer table ──────────────────────────────────────────────────────────

export function CustomerTable({
  booking,
  compact = false,
}: {
  booking: BookingDetail
  compact?: boolean
}) {
  const divers = booking.divers
  const profiles = booking.customerProfiles

  if (divers.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        No customers added.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {divers.map((diver, idx) => {
        const profile = profiles[idx]
        const portalComplete = profile?.submittedAt != null
        return (
          <div
            key={idx}
            className={`flex items-center justify-between gap-3 ${compact ? 'p-2.5' : 'p-3'} rounded-lg border`}
            style={{
              background: 'var(--color-glass-bg)',
              borderColor: 'var(--color-glass-border)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base flex-shrink-0" aria-label={diver.flag.label}>
                {[...diver.flag.code.toUpperCase()]
                  .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
                  .join('')}
              </span>
              <div className="min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {diver.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {diver.activityType.map(courseLabel).join(', ')}
                </p>
              </div>
            </div>
            <GlassBadge variant={portalComplete ? 'success' : 'default'} size="sm" dot>
              {portalComplete ? 'Completed' : 'Pending'}
            </GlassBadge>
          </div>
        )
      })}
    </div>
  )
}

// ── Stakeholder list ────────────────────────────────────────────────────────

export function StakeholderList({
  stakeholders,
  compact = false,
}: {
  stakeholders: BookingDetailStakeholder[]
  compact?: boolean
}) {
  if (stakeholders.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        No resources assigned.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {stakeholders.map((s, idx) => (
        <li
          key={idx}
          className={`flex items-center justify-between gap-3 ${compact ? 'p-2.5' : 'p-3'} rounded-lg border`}
          style={{
            background: 'var(--color-glass-bg)',
            borderColor: 'var(--color-glass-border)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex-shrink-0 ${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-full flex items-center justify-center`}
              style={{
                background: 'var(--color-glass-bg-elevated)',
                border: '1px solid var(--color-glass-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <RoleIcon role={s.role as ClerkRole} size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {s.name}
                </p>
                {s.isExternal && (
                  <GlassBadge variant="default" size="sm">
                    External
                  </GlassBadge>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {s.role}
                {s.email && <> · {s.email}</>}
              </p>
            </div>
          </div>
          {s.reservationStatus && (
            <GlassBadge variant={reservationVariant(s.reservationStatus)} size="sm" dot>
              {s.reservationStatus === 'PendingAcceptance' ? 'Pending' : s.reservationStatus}
            </GlassBadge>
          )}
        </li>
      ))}
    </ul>
  )
}

// ── Portal link section ─────────────────────────────────────────────────────

export function PortalLinkSection({
  bookingId,
  portalLink,
  divers,
  compact = false,
}: {
  bookingId: string
  portalLink: BookingLinkInfo | null | undefined
  divers: BookingDetail['divers']
  compact?: boolean
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

  const iconSize = compact ? 12 : 14
  const buttonIconSize = compact ? 13 : 14

  if (portalLink) {
    const isExpired = portalLink.expiresAt < Date.now()
    return (
      <div className="space-y-2">
        <div
          data-testid="portal-link-url"
          className={`flex items-center gap-2 ${compact ? 'p-2.5 text-xs' : 'p-3 text-sm'} rounded-lg border font-mono break-all`}
          style={{
            background: 'var(--color-glass-bg)',
            borderColor: 'var(--color-glass-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <ExternalLink size={iconSize} className="flex-shrink-0" />
          <span className={`flex-1${compact ? ' truncate' : ''}`}>{portalUrl}</span>
        </div>
        {!compact && isExpired && (
          <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
            This link has expired.
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <GlassButton variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check size={buttonIconSize} /> : <Copy size={buttonIconSize} />}
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
      <ExternalLink size={buttonIconSize} />
      Send Portal Link
    </GlassButton>
  )
}
