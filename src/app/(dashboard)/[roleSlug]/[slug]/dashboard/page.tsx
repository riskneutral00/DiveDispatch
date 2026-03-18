'use client'

import { use, useCallback, useMemo, useState } from 'react'
import { Anchor, Trash2 } from 'lucide-react'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { DASHBOARD_CONFIGS } from '@/lib/constants/dashboard-config'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog'
import { BookingCalendar } from '@/components/booking/booking-calendar'
import { BookingQuickDetail } from '@/components/booking/booking-quick-detail'
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner'
import { RoleTabBar } from '@/components/dashboard/role-tab-bar'
import { OpenRequests } from '@/components/dashboard/open-requests'
import { GlassCard, GlassDialog, GlassButton } from '@/components/glass'
import { BookingStatusBadge } from '@/components/glass/booking-status-badge'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { useBlockedDateToggle } from '@/lib/hooks/use-blocked-date-toggle'
import { useDevSwitching } from '@/components/dev/dev-switch-context'
import { isUrgentDraft, urgentCountdown } from '@/lib/utils/booking-urgency'
import { api } from '../../../../../../convex/_generated/api'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../../../../convex/bookings'

const OPERATOR_TYPES = new Set<string>([
  'DiveCenter',
  'Agent',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
  'DiveSite',
])

type OperatorType = 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel' | 'DiveSite'

function getToday(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function DashboardContent({
  roleSlug,
  slug,
}: {
  roleSlug: string
  slug: string
}) {
  const { user: convexUser } = useCurrentUser()
  const roleConfig = ROLE_BY_KEY[roleSlug as RoleKey]
  const RoleIcon = roleConfig?.icon ?? Anchor
  const isOrganizer = roleConfig?.isOrganizer ?? false
  const isResourceOnly = (roleConfig?.isResource ?? false) && !isOrganizer
  const clerkRole = roleConfig?.clerkRole
  const dashConfig = DASHBOARD_CONFIGS[roleSlug]

  const isOperator = clerkRole ? OPERATOR_TYPES.has(clerkRole) : false

  // Skip queries during dev-switcher transitions to prevent FORBIDDEN errors
  const { isSwitching } = useDevSwitching()

  const { data: bookings } = useStableQuery(
    api.bookings.listByOwner,
    isOperator && clerkRole && !isSwitching
      ? { ownerId: slug, ownerType: clerkRole as OperatorType }
      : 'skip',
  )

  const { data: dashboardData } = useStableQuery(
    api.bookings.myDashboard,
    isResourceOnly && !isSwitching ? {} : 'skip',
  )

  const resourceBookings = dashboardData?.bookings ?? []
  const calendarBookings: CalendarBooking[] = isOperator ? (bookings ?? []) : resourceBookings

  const legendStatuses = dashConfig?.legendStatuses ?? (['Active', 'Draft', 'Upcoming', 'Completed'] as CalendarDisplayStatus[])

  const { blockedDates, pendingToggle, requestToggle, confirmToggle, cancelToggle, isToggling } =
    useBlockedDateToggle({ ownerSlug: slug, roleType: clerkRole ?? '' })

  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null)
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<CalendarDisplayStatus>>(
    new Set(['Completed']),
  )

  const handleRangeChange = useCallback(
    (start: string, end: string) => setCalendarRange({ start, end }),
    [],
  )

  // Phase 5: click-to-detail
  const [detailBooking, setDetailBooking] = useState<CalendarBooking | null>(null)
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)

  const handleBookingClick = useCallback(
    (id: string) => {
      const booking = calendarBookings.find((b) => b._id === id)
      if (booking) setDetailBooking(booking)
    },
    [calendarBookings],
  )

  // Phase 4: upcoming list — all non-terminal bookings whose endDate hasn't passed
  const today = useMemo(() => getToday(), [])

  const upcomingBookings = useMemo(() => {
    if (!isOrganizer || !bookings) return []
    return (bookings as CalendarBooking[])
      .filter((b) => {
        if (b.endDate < today) return false
        if (b.status === 'Cancelled' || b.status === 'Completed') return false
        if (calendarRange && (b.startDate > calendarRange.end || b.endDate < calendarRange.start)) return false
        if (hiddenStatuses.has(b.status as CalendarDisplayStatus)) return false
        return true
      })
      .sort((a, b) => {
        // Urgent drafts float to top
        const aUrgent = isUrgentDraft(a) ? 0 : 1
        const bUrgent = isUrgentDraft(b) ? 0 : 1
        if (aUrgent !== bUrgent) return aUrgent - bUrgent
        return a.startDate.localeCompare(b.startDate)
      })
      .slice(0, 10)
  }, [bookings, isOrganizer, today, calendarRange, hiddenStatuses])

  const bottomContent = useMemo(() => {
    if (isResourceOnly && !dashConfig?.calendarOnly) {
      return (
        <div>
          <h2
            className="text-base font-semibold mb-3"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {dashConfig?.widgetTitle ?? 'OPEN REQUESTS'}
          </h2>
          <OpenRequests confirmOnDecline />
        </div>
      )
    }

    if (isOrganizer) {
      return (
        <div>
          <h2
            className="text-base font-semibold mb-3"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {dashConfig?.widgetTitle ?? 'UPCOMING BOOKINGS'}
          </h2>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-secondary)' }}>
              {dashConfig?.emptyMessage ?? 'No upcoming bookings.'}
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingBookings.map((b) => {
                const urgent = isUrgentDraft(b)
                const countdown = urgentCountdown(b)
                return (
                  <button
                    key={b._id}
                    className={`w-full text-left${urgent ? ' urgent-pulse' : ''}`}
                    onClick={() => setDetailBooking(b)}
                  >
                    {urgent ? (
                      <div
                        className="p-3 rounded-[var(--border-radius)] hover:scale-[1.01] cursor-pointer transition-transform"
                        style={{
                          background: 'var(--color-status-urgent)',
                          color: '#ffffff',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {b.activityType.join(', ')}
                            </p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                              {b.startDate}
                              {b.endDate !== b.startDate && ` → ${b.endDate}`}
                              {b.diverCount > 0 && ` · ${b.diverCount} divers`}
                              {b.customerName && ` · ${b.customerName}`}
                            </p>
                          </div>
                          {countdown && (
                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.9)' }}>
                              {countdown}
                            </span>
                          )}
                          <span
                            className="inline-flex items-center font-medium rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: 'rgba(255,255,255,0.95)',
                              color: 'var(--color-status-urgent)',
                              border: '1px solid rgba(255,255,255,0.5)',
                            }}
                          >
                            Urgent
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded-full hover:bg-white/20 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setCancelBookingId(b._id) }}
                            aria-label="Cancel booking"
                          >
                            <Trash2 size={16} style={{ color: 'rgba(255,255,255,0.9)' }} />
                          </button>
                        </div>
                      </div>
                    ) : (
                    <GlassCard padding="sm" hoverable>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {b.activityType.join(', ')}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {b.startDate}
                            {b.endDate !== b.startDate && ` → ${b.endDate}`}
                            {b.diverCount > 0 && ` · ${b.diverCount} divers`}
                            {b.customerName && ` · ${b.customerName}`}
                          </p>
                        </div>
                        <BookingStatusBadge status={b.status} />
                        {b.status === 'Draft' && (
                          <button
                            type="button"
                            className="p-1 rounded-full transition-colors"
                            style={{ color: 'var(--color-destructive)' }}
                            onClick={(e) => { e.stopPropagation(); setCancelBookingId(b._id) }}
                            aria-label="Cancel booking"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </GlassCard>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return null
  }, [isResourceOnly, isOrganizer, dashConfig, upcomingBookings])

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <ProfileCompletionBanner roleSlug={roleSlug as RoleKey} slug={slug} />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <RoleIcon size={26} style={{ color: 'var(--color-primary)' }} />
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {convexUser?.businessName ?? roleConfig?.label ?? roleSlug} Dashboard
          </h1>
        </div>
      </div>

      {/* Role tab bar — between heading and calendar */}
      <RoleTabBar roleSlug={roleSlug as RoleKey} slug={slug} />

      {/* Skyline Calendar + bottom content as separate GlassCard */}
      <BookingCalendar
        bookings={calendarBookings}
        blockedDates={blockedDates}
        onDateClick={requestToggle}
        onBookingClick={handleBookingClick}
        onRangeChange={handleRangeChange}
        onHiddenStatusesChange={setHiddenStatuses}
        legendStatuses={legendStatuses as CalendarDisplayStatus[]}
        bottomContent={bottomContent}
      />

      {/* Click-to-detail dialog */}
      <BookingQuickDetail
        booking={detailBooking}
        onClose={() => setDetailBooking(null)}
      />

      {/* Cancel booking dialog for Draft trash icon */}
      {cancelBookingId && (
        <CancelBookingDialog
          open
          onClose={() => setCancelBookingId(null)}
          bookingId={cancelBookingId as import('../../../../../../convex/_generated/dataModel').Id<'bookings'>}
          onSuccess={() => setCancelBookingId(null)}
        />
      )}

      {/* Block/unblock date confirmation dialog */}
      {pendingToggle && (
        <GlassDialog
          open={pendingToggle !== null}
          onClose={cancelToggle}
          title={pendingToggle.mode === 'block' ? 'Block this date?' : 'Unblock this date?'}
          size="sm"
        >
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {pendingToggle.mode === 'block'
              ? `Block ${pendingToggle.date}? Operators will not be able to book you on this date.`
              : `Unblock ${pendingToggle.date}? You will become available for bookings on this date again.`}
          </p>
          <div className="flex justify-end gap-2">
            <GlassButton size="sm" variant="secondary" onClick={cancelToggle} disabled={isToggling}>
              Cancel
            </GlassButton>
            <GlassButton
              size="sm"
              variant={pendingToggle.mode === 'block' ? 'destructive' : 'primary'}
              onClick={confirmToggle}
              disabled={isToggling}
            >
              {isToggling
                ? 'Saving…'
                : pendingToggle.mode === 'block'
                  ? 'Block'
                  : 'Unblock'}
            </GlassButton>
          </div>
        </GlassDialog>
      )}
    </div>
  )
}

export default function DashboardPage({
  params,
}: {
  params: Promise<{ roleSlug: string; slug: string }>
}) {
  const { roleSlug, slug } = use(params)
  return <DashboardContent roleSlug={roleSlug} slug={slug} />
}
