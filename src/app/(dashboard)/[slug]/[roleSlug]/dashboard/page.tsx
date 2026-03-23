'use client'

import { use, useCallback, useState } from 'react'
import { useMutation } from 'convex/react'
import { Anchor } from 'lucide-react'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { DASHBOARD_CONFIGS } from '@/lib/constants/dashboard-config'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { BookingCalendar } from '@/components/booking/booking-calendar'
import { BookingQuickDetail } from '@/components/booking/booking-quick-detail'
import { BookingOverlay } from '@/components/booking/booking-overlay'
import { QuickBookRail } from '@/components/booking/quick-book-rail'
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog'
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner'
import { GlassDialog, GlassButton } from '@/components/glass'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { useBlockedDateToggle } from '@/lib/hooks/use-blocked-date-toggle'
import { useDevSwitching } from '@/components/dev/dev-switch-context'
import { api } from '../../../../../../convex/_generated/api'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../../../../convex/bookings'
import type { Id } from '../../../../../../convex/_generated/dataModel'

const OPERATOR_TYPES = new Set<string>([
  'DiveCenter',
  'Agent',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
])

type OperatorType = 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel'

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

  // Booking overlay state
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayCourses, setOverlayCourses] = useState<string[]>([])
  const [wizardKey, setWizardKey] = useState(0)

  function openBookingOverlay(courses: string[] = []) {
    setOverlayCourses(courses)
    setWizardKey((k) => k + 1)
    setOverlayOpen(true)
  }

  // Urgent cancel (operator) / accept+decline (resource) state
  const [urgentCancelId, setUrgentCancelId] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const acceptByBooking = useMutation(api.reservationsMutations.acceptByBookingForCaller)
  const declineByBooking = useMutation(api.reservationsMutations.declineByBookingForCaller)

  // Resource: accept reservation from quick detail dialog
  async function handleDetailAccept(bookingId: string) {
    setIsAccepting(true)
    setDetailError(null)
    try {
      await acceptByBooking({ bookingId: bookingId as Id<'bookings'> })
      setDetailBooking(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept booking'
      setDetailError(message)
    } finally {
      setIsAccepting(false)
    }
  }

  // Resource: decline reservation from quick detail dialog or pill X
  async function handleDetailDecline(bookingId: string) {
    setIsDeclining(true)
    setDetailError(null)
    try {
      await declineByBooking({ bookingId: bookingId as Id<'bookings'> })
      setDetailBooking(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline booking'
      setDetailError(message)
    } finally {
      setIsDeclining(false)
    }
  }

  function handleUrgentCancel(bookingId: string) {
    if (isOperator) {
      setUrgentCancelId(bookingId)
    } else {
      handleDetailDecline(bookingId)
    }
  }

  // Phase 5: click-to-detail
  const [detailBooking, setDetailBooking] = useState<CalendarBooking | null>(null)

  const handleBookingClick = useCallback(
    (id: string) => {
      const booking = calendarBookings.find((b) => b._id === id)
      if (booking) setDetailBooking(booking)
    },
    [calendarBookings],
  )

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <ProfileCompletionBanner roleSlug={roleSlug as RoleKey} slug={slug} />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <RoleIcon size={26} style={{ color: 'var(--color-primary)' }} />
          <h1
            className="text-2xl font-bold flex-1"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {convexUser?.businessName ?? roleConfig?.label ?? roleSlug} Dashboard
          </h1>
        </div>
        {isOrganizer && (
          <div className="mt-3">
            <QuickBookRail onSelect={(courses) => openBookingOverlay(courses)} />
          </div>
        )}
      </div>


      {/* Skyline Calendar */}
      <BookingCalendar
        bookings={calendarBookings}
        blockedDates={blockedDates}
        onDateClick={requestToggle}
        onBookingClick={handleBookingClick}
        onRangeChange={handleRangeChange}
        onHiddenStatusesChange={setHiddenStatuses}
        onUrgentCancel={handleUrgentCancel}
        legendStatuses={legendStatuses as CalendarDisplayStatus[]}
        allDraftsUrgent={isResourceOnly}
        viewerRole={clerkRole}
      />

      {/* Click-to-detail dialog */}
      <BookingQuickDetail
        booking={detailBooking}
        onClose={() => { setDetailBooking(null); setDetailError(null) }}
        onAccept={detailBooking?.reservationStatus === 'PendingAcceptance' ? handleDetailAccept : undefined}
        onDecline={detailBooking?.reservationStatus === 'PendingAcceptance' ? handleDetailDecline : undefined}
        isAccepting={isAccepting}
        isDeclining={isDeclining}
        error={detailError}
      />

      {/* Operator: cancel booking dialog */}
      {urgentCancelId && (
        <CancelBookingDialog
          open
          onClose={() => setUrgentCancelId(null)}
          bookingId={urgentCancelId as Id<'bookings'>}
          onSuccess={() => setUrgentCancelId(null)}
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

      {/* Booking creation overlay */}
      {isOrganizer && (
        <BookingOverlay
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          initialCourses={overlayCourses}
          wizardKey={wizardKey}
        />
      )}
    </div>
  )
}

export default function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { roleSlug, slug } = use(params)
  return <DashboardContent roleSlug={roleSlug} slug={slug} />
}
