'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { BookingDetail, BookingDetailStakeholder } from '../../../convex/bookings'
import type { BookingLinkInfo } from '../../../convex/bookingLinks'
import { Button, ButtonGroup, Badge, Card, RoleIcon, EmptyState, ListRow, Skeleton, Input } from '@/components/ui'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import type { ClerkRole } from '@/lib/constants/roles'
import { courseLabel } from '@/lib/constants/course-catalog'
import { computeTTLLabel, reservationVariant } from '@/lib/booking/booking-display'
import { useCopyFeedback } from '@/lib/hooks/use-copy-feedback'
import { useTranslations } from 'next-intl'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ReservationStatusList } from './reservation-status-list'
import { SessionTimeline } from './session-timeline'
import { AuditTrailTable } from './audit-trail-table'
import { SendPortalLink } from './send-portal-link'
import { PortalProgressCard } from './portal-progress-card'

export function useTTLCountdown(expiresAt: number | undefined): string | null {
  const [label, setLabel] = useState<string | null>(() => computeTTLLabel(expiresAt))

  useEffect(() => {
    if (!expiresAt) return
    const interval = setInterval(() => setLabel(computeTTLLabel(expiresAt)), 60_000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return label
}

interface PortalPill {
  label: string
  done: boolean
}

function PortalPills({ pills }: { pills: PortalPill[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {pills.map(({ label, done }) => (
        <Badge key={label} variant={done ? 'success' : 'muted'} size="sm" dot>
          {label}
        </Badge>
      ))}
    </div>
  )
}

function CustomerTable({
  booking,
  compact = false,
}: {
  booking: BookingDetail
  compact?: boolean
}) {
  const divers = booking.divers
  const profiles = booking.customerProfiles

  return (
    <div className="space-y-2">
      {divers.map((diver, idx) => {
        const profile = profiles[idx]
        const portalComplete = profile?.submittedAt != null
        return (
          <ListRow key={idx} compact={compact}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base flex-shrink-0" /* design-ok: emoji size */ aria-label={diver.flag.label}>
                {[...diver.flag.code.toUpperCase()]
                  .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
                  .join('')}
              </span>
              <div className="min-w-0">
                <p className="text-body font-medium truncate text-primary">
                  {diver.name}
                </p>
                <p className="text-label text-secondary">
                  {diver.activityType.map(courseLabel).join(', ')}
                </p>
              </div>
            </div>
            <Badge variant={portalComplete ? 'success' : 'default'} size="sm" dot>
              {portalComplete ? 'Completed' : 'Pending'}
            </Badge>
          </ListRow>
        )
      })}
    </div>
  )
}

function StakeholderList({
  stakeholders,
  compact = false,
}: {
  stakeholders: BookingDetailStakeholder[]
  compact?: boolean
}) {
  if (stakeholders.length === 0) {
    return <EmptyState message="No resources assigned." />
  }

  return (
    <ul className="space-y-2">
      {stakeholders.map((s, idx) => (
        <ListRow key={idx} as="li" compact={compact}>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex-shrink-0 ${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-full flex items-center justify-center text-secondary bg-[var(--color-glass-bg-elevated)] border border-glass-border`}
            >
              <RoleIcon role={s.role as ClerkRole} size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-body font-medium truncate text-primary">
                  {s.name}
                </p>
                {s.isExternal && (
                  <Badge variant="default" size="sm">
                    External
                  </Badge>
                )}
              </div>
              <p className="text-label text-secondary">
                {s.role}
                {s.displaySub && <> · {s.displaySub}</>}
              </p>
            </div>
          </div>
          {s.reservationStatus && (
            <Badge variant={reservationVariant(s.reservationStatus)} size="sm" dot>
              {s.reservationStatus === 'PendingAcceptance' ? 'Pending' : s.reservationStatus}
            </Badge>
          )}
        </ListRow>
      ))}
    </ul>
  )
}

function PortalLinkSection({
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
  const tErrors = useTranslations('errors')
  const tCommon = useTranslations('common')
  const [copied, markCopied] = useCopyFeedback()
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
    markCopied()
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
      setCreateError(tCommon('actionFailed', { action: 'Generate link' }))
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
          className={`flex items-center gap-2 ${compact ? 'p-2.5 text-label' : 'p-3 text-body'} rounded-theme border font-mono break-all text-secondary bg-glass-bg border-glass-border`}
        >
          <ExternalLink size={iconSize} className="flex-shrink-0" />
          <span className={`flex-1${compact ? ' truncate' : ''}`}>{portalUrl}</span>
        </div>
        {!compact && isExpired && (
          <p className="text-label text-destructive">
            {tErrors('linkExpired')}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check size={buttonIconSize} /> : <Copy size={buttonIconSize} />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(true)}>
            New Link
          </Button>
        </div>
      </div>
    )
  }

  if (showCreateForm) {
    return (
      <form onSubmit={handleCreate} className="space-y-3">
        <div>
          <label
            className="text-label font-medium block mb-1 text-secondary"
          >
            Customer name
          </label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            className="text-label font-medium block mb-1 text-secondary"
          >
            Customer email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {createError && (
          <p className="text-label text-destructive">
            {createError}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" loading={creating}>
            Generate Link
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateForm(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => setShowCreateForm(true)}>
      <ExternalLink size={buttonIconSize} />
      Send Link
    </Button>
  )
}

export function BookingDetailSkeleton() {
  return (
    <DashboardPageFrame className="min-h-screen p-4 sm:p-6 space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} padding="md">
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </DashboardPageFrame>
  )
}

export type SectionId = 'overview' | 'customers' | 'schedule' | 'resources' | 'reservations' | 'audit'

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'customers', label: 'Customers' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'resources', label: 'Resources' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'audit', label: 'Audit' },
]

function SectionTabs({
  active,
  onChange,
}: {
  active: SectionId
  onChange: (id: SectionId) => void
}) {
  return (
    <ButtonGroup
      variant="tabs"
      value={active}
      onChange={(v) => onChange(v as SectionId)}
      options={SECTIONS.map(({ id, label }) => ({ value: id, label }))}
      aria-label="Booking sections"
    />
  )
}

function CustomersSection({
  booking,
  compact,
}: {
  booking: BookingDetail
  compact: boolean
}) {
  return (
    <>
      <FormSectionHeader label="Customers" />
      {booking.divers.length === 0 ? (
        <EmptyState message="No customers added." />
      ) : (
        <CustomerTable booking={booking} compact={compact} />
      )}
    </>
  )
}

function ScheduleSection({ booking }: { booking: BookingDetail }) {
  return (
    <>
      <FormSectionHeader label="Schedule" />
      {booking.sessions.length === 0 ? (
        <p className="text-body text-secondary">No sessions scheduled.</p>
      ) : (
        <SessionTimeline sessions={booking.sessions} />
      )}
    </>
  )
}

function ResourcesSection({
  booking,
  compact,
}: {
  booking: BookingDetail
  compact: boolean
}) {
  return (
    <>
      <FormSectionHeader label={compact ? 'Resources' : 'Stakeholders'} />
      <StakeholderList stakeholders={booking.stakeholders} compact={compact} />
    </>
  )
}

function ReservationsSection({ booking }: { booking: BookingDetail }) {
  return (
    <>
      <FormSectionHeader label="Reservations" />
      <ReservationStatusList reservations={booking.reservations} />
    </>
  )
}

function PortalSection({
  booking,
  bookingId,
  portalLink,
  compact,
}: {
  booking: BookingDetail
  bookingId: string
  portalLink: BookingLinkInfo | null | undefined
  compact: boolean
}) {
  return (
    <>
      <FormSectionHeader label="Customer Portal" />
      {!compact && (
        <PortalProgressCard
          portalContact={booking.portalContact}
          portalMedical={booking.portalMedical}
          portalWaiver={booking.portalWaiver}
          customerFormComplete={booking.customerFormComplete}
          customerProfiles={booking.customerProfiles}
        />
      )}
      {compact && (
        <PortalPills
          pills={buildPortalPills(booking)}
        />
      )}
      <div className={`${compact ? 'mt-3' : 'mt-4 pt-3 border-t border-glass-border'} space-y-3`}>
        <PortalLinkSection
          bookingId={bookingId}
          portalLink={portalLink ?? null}
          divers={booking.divers}
          compact={compact}
        />
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
    </>
  )
}

function AuditSection({ bookingId }: { bookingId: string }) {
  return (
    <>
      <FormSectionHeader label="Audit Trail" />
      <AuditTrailTable bookingId={bookingId} />
    </>
  )
}

function buildPortalPills(booking: BookingDetail): PortalPill[] {
  const equipmentDone =
    booking.customerProfiles.length > 0 &&
    booking.customerProfiles.every((p) => p.submittedAt != null)

  return [
    { label: 'Contact', done: booking.portalContact },
    { label: 'Medical', done: booking.portalMedical },
    { label: 'Waiver', done: booking.portalWaiver },
    { label: 'Equipment', done: equipmentDone },
    { label: 'Payment', done: false },
  ]
}

export interface BookingDetailBodyProps {
  booking: BookingDetail
  bookingId: string
  portalLink: BookingLinkInfo | null | undefined
  layout: 'page' | 'dialog'
  compact?: boolean
  activeSection?: SectionId
  onSectionChange?: (id: SectionId) => void
  overviewSlot?: React.ReactNode
}

export function BookingDetailBody({
  booking,
  bookingId,
  portalLink,
  layout,
  compact = false,
  activeSection = 'overview',
  onSectionChange,
  overviewSlot,
}: BookingDetailBodyProps) {
  if (layout === 'page') {
    return (
      <>
        {booking.divers.length > 0 && (
          <Card padding="md">
            <CustomersSection booking={booking} compact={compact} />
          </Card>
        )}

        {booking.sessions.length > 0 && (
          <Card padding="md">
            <ScheduleSection booking={booking} />
          </Card>
        )}

        <Card padding="md">
          <ResourcesSection booking={booking} compact={compact} />
        </Card>

        <Card padding="md">
          <ReservationsSection booking={booking} />
        </Card>

        <Card padding="md">
          <PortalSection
            booking={booking}
            bookingId={bookingId}
            portalLink={portalLink}
            compact={compact}
          />
        </Card>

        <Card padding="md">
          <AuditSection bookingId={bookingId} />
        </Card>
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
        <SectionTabs
          active={activeSection}
          onChange={(id) => onSectionChange?.(id)}
        />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-5">
        {activeSection === 'overview' && overviewSlot && (
          <>
            {overviewSlot}
            <PortalSection
              booking={booking}
              bookingId={bookingId}
              portalLink={portalLink}
              compact={compact}
            />
          </>
        )}

        {activeSection === 'customers' && (
          <CustomersSection booking={booking} compact={compact} />
        )}

        {activeSection === 'schedule' && (
          <ScheduleSection booking={booking} />
        )}

        {activeSection === 'resources' && (
          <ResourcesSection booking={booking} compact={compact} />
        )}

        {activeSection === 'reservations' && (
          <ReservationsSection booking={booking} />
        )}

        {activeSection === 'audit' && (
          <AuditSection bookingId={bookingId} />
        )}
      </div>
    </div>
  )
}
