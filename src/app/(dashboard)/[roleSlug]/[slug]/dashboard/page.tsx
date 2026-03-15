'use client'

import { use, useState } from 'react'
import { Anchor } from 'lucide-react'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { DASHBOARD_CONFIGS } from '@/lib/constants/dashboard-config'
import { BookingCalendar } from '@/components/booking/booking-calendar'
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner'
import { OpenRequests } from '@/components/dashboard/open-requests'
import { GlassCard, GlassDialog, GlassButton } from '@/components/glass'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { useBlockedDateToggle } from '@/lib/hooks/use-blocked-date-toggle'
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

function DashboardContent({
  roleSlug,
  slug,
}: {
  roleSlug: string
  slug: string
}) {
  const roleConfig = ROLE_BY_KEY[roleSlug as RoleKey]
  const RoleIcon = roleConfig?.icon ?? Anchor
  const isOrganizer = roleConfig?.isOrganizer ?? false
  const isResourceOnly = (roleConfig?.isResource ?? false) && !isOrganizer
  const clerkRole = roleConfig?.clerkRole
  const dashConfig = DASHBOARD_CONFIGS[roleSlug]

  const isOperator = clerkRole ? OPERATOR_TYPES.has(clerkRole) : false

  const { data: bookings } = useStableQuery(
    api.bookings.listByOwner,
    isOperator && clerkRole
      ? { ownerId: slug, ownerType: clerkRole as OperatorType }
      : 'skip',
  )

  const { data: dashboardData } = useStableQuery(
    api.bookings.myDashboard,
    isResourceOnly ? {} : 'skip',
  )

  const resourceBookings = dashboardData?.bookings ?? []
  const calendarBookings: CalendarBooking[] = isOperator ? (bookings ?? []) : resourceBookings

  const legendStatuses = dashConfig?.legendStatuses ?? (['Active', 'Draft', 'Upcoming', 'Completed'] as CalendarDisplayStatus[])

  const { blockedDates, pendingToggle, requestToggle, confirmToggle, cancelToggle, isToggling } =
    useBlockedDateToggle()

  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null)
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<CalendarDisplayStatus>>(
    new Set(['Completed']),
  )

  const canBlockDates = isResourceOnly

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ProfileCompletionBanner roleSlug={roleSlug as RoleKey} slug={slug} />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <RoleIcon size={26} style={{ color: 'var(--color-primary)' }} />
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {roleConfig?.label ?? roleSlug} Dashboard
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {slug}
        </p>
      </div>

      {/* Skyline Calendar */}
      <BookingCalendar
        bookings={calendarBookings}
        blockedDates={canBlockDates ? blockedDates : undefined}
        onDateClick={canBlockDates ? requestToggle : undefined}
        onRangeChange={(start, end) => setCalendarRange({ start, end })}
        onHiddenStatusesChange={setHiddenStatuses}
        legendStatuses={legendStatuses as CalendarDisplayStatus[]}
      />

      {/* Widget area — resources: open requests */}
      {isResourceOnly && !dashConfig?.calendarOnly && (
        <div>
          <h2
            className="text-base font-semibold mb-3"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {dashConfig?.widgetTitle ?? 'OPEN REQUESTS'}
          </h2>
          <OpenRequests confirmOnDecline />
        </div>
      )}

      {/* Widget area — organizers: booking list synced to calendar */}
      {isOrganizer && (
        <div>
          <h2
            className="text-base font-semibold mb-3"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {dashConfig?.widgetTitle ?? 'BOOKINGS'}
          </h2>
          {(!bookings || bookings.length === 0) ? (
            <GlassCard padding="md">
              <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
                {dashConfig?.emptyMessage ?? 'No bookings yet.'}
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {(bookings as CalendarBooking[])
                .filter((b: CalendarBooking) => {
                  if (!calendarRange) return true
                  return b.startDate <= calendarRange.end && b.endDate >= calendarRange.start
                })
                .filter((b: CalendarBooking) =>
                  !hiddenStatuses.has(b.status as CalendarDisplayStatus),
                )
                .slice(0, 10)
                .map((b: CalendarBooking) => (
                  <GlassCard key={b._id} padding="sm" hoverable>
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
                        </p>
                      </div>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: `var(--color-status-${b.status.toLowerCase()}-bg, var(--color-glass-bg))`,
                          color: `var(--color-status-${b.status.toLowerCase()}, var(--color-text-secondary))`,
                          border: `1px solid var(--color-status-${b.status.toLowerCase()}-border, var(--color-glass-border))`,
                        }}
                      >
                        {b.status}
                      </span>
                    </div>
                  </GlassCard>
                ))}
            </div>
          )}
        </div>
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
