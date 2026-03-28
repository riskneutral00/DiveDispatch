'use client'

import { useCallback, useEffect, useState } from 'react'
import { Anchor } from 'lucide-react'
import { DragDropProvider, DragOverlay } from '@dnd-kit/react'

import { ROLE_BY_KEY, ORGANIZER_ROLE_KEYS, type RoleKey } from '@/lib/constants/roles'
import { DASHBOARD_CONFIGS } from '@/lib/constants/dashboard-config'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { useBlockedDateToggle } from '@/lib/hooks/use-blocked-date-toggle'
import { useDevSwitching } from '@/components/dev/dev-switch-context'
import { useBookingActions } from '@/lib/hooks/use-booking-actions'
import { useOperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import { useBookingDnd, BOOKING_DND_SENSORS } from '@/lib/hooks/use-booking-dnd'
import { BookingCalendar } from '@/components/booking/booking-calendar'
import { BookingQuickDetail } from '@/components/booking/booking-quick-detail'
import { BookingOverlay } from '@/components/booking/booking-overlay'
import { QuickBookRail } from '@/components/booking/quick-book-rail'
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog'
import { BlockDateDialog } from '@/components/booking/block-date-dialog'
import { DragOverlayPill } from '@/components/booking/drag-overlay-pill'
import { api } from '../../../convex/_generated/api'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../convex/bookings'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BookingPreFill } from '@/lib/booking/wizard-state'

type OperatorType = 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel'

// ── Main Component ──────────────────────────────────────────────────────────

export function DashboardContent({ roleSlug, slug }: { roleSlug: string; slug: string }) {
  const { user: convexUser } = useCurrentUser()
  const roleConfig = ROLE_BY_KEY[roleSlug as RoleKey]
  const RoleIcon = roleConfig?.icon ?? Anchor
  const isOrganizer = roleConfig?.isOrganizer ?? false
  const isResourceOnly = (roleConfig?.isResource ?? false) && !isOrganizer
  const clerkRole = roleConfig?.clerkRole
  const dashConfig = DASHBOARD_CONFIGS[roleSlug]
  const isOperator = clerkRole ? ORGANIZER_ROLE_KEYS.has(clerkRole) : false

  const { defaults } = useOperatorDefaults()
  const { isSwitching } = useDevSwitching()

  // ── Data queries ─────────────────────────────────────────────────────────

  const { data: bookings } = useStableQuery(
    api.bookings.listByOwner,
    isOperator && clerkRole && !isSwitching
      ? { ownerId: slug, ownerType: clerkRole as OperatorType }
      : 'skip',
  )
  const { data: dashboardData } = useStableQuery(
    api.bookings.myDashboard,
    isResourceOnly && clerkRole && !isSwitching ? { activeRole: clerkRole } : 'skip',
  )
  const calendarBookings: CalendarBooking[] = isOperator ? (bookings ?? []) : (dashboardData?.bookings ?? [])
  const legendStatuses = dashConfig?.legendStatuses ?? (['Active', 'Draft', 'Upcoming', 'Completed'] as CalendarDisplayStatus[])

  const { blockedDates, pendingToggle, requestToggle, confirmToggle, cancelToggle, isToggling } =
    useBlockedDateToggle({ ownerSlug: slug, roleType: clerkRole ?? '' })

  // ── Booking overlay state ────────────────────────────────────────────────

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayCourses, setOverlayCourses] = useState<string[]>([])
  const [overlayPreFill, setOverlayPreFill] = useState<BookingPreFill | undefined>(undefined)
  const [wizardKey, setWizardKey] = useState(0)

  function openBookingOverlay(courses: string[] = [], preFill?: BookingPreFill) {
    setOverlayCourses(courses)
    setOverlayPreFill(preFill)
    setWizardKey((k) => k + 1)
    setOverlayOpen(true)
  }

  // ── Drag-to-date ────────────────────────────────────────────────────────

  const dnd = useBookingDnd({ defaults })

  // When a pill is dropped on a date, open the wizard with pre-fill
  useEffect(() => {
    if (dnd.pendingPreFill) {
      openBookingOverlay(dnd.pendingPreFill.courses, dnd.pendingPreFill)
      dnd.clearPendingPreFill()
    }
  }, [dnd.pendingPreFill, dnd.clearPendingPreFill])

  // ── Extracted hooks ────────────────────────────────────────────────────────

  const actions = useBookingActions()

  // ── Derived callbacks ──────────────────────────────────────────────────────

  const handleBookingClick = useCallback(
    (id: string) => actions.handleBookingClick(id, calendarBookings),
    [actions.handleBookingClick, calendarBookings],
  )

  const handleUrgentCancel = useCallback(
    (bookingId: string) => actions.handleUrgentCancel(bookingId, isOperator),
    [actions.handleUrgentCancel, isOperator],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  const calendarAndRail = (
    <>
      <div>
        <div className="flex items-center gap-3 mb-1">
          <RoleIcon size={26} style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-2xl font-bold flex-1 text-primary" style={{ fontFamily: 'var(--font-heading)' }}>
            {convexUser?.businessName ?? roleConfig?.label ?? roleSlug} Dashboard
          </h1>
        </div>
        {isOrganizer && (
          <div className="mt-3">
            <QuickBookRail
              onSelect={(courses) => openBookingOverlay(courses as string[])}
              dragEnabled={isOrganizer}
            />
          </div>
        )}
      </div>

      <BookingCalendar
        bookings={calendarBookings}
        blockedDates={blockedDates}
        onDateClick={requestToggle}
        onBookingClick={handleBookingClick}
        onUrgentCancel={handleUrgentCancel}
        legendStatuses={legendStatuses as CalendarDisplayStatus[]}
        allDraftsUrgent={isResourceOnly}
        viewerRole={clerkRole}
        droppableEnabled={isOrganizer}
      />
    </>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {isOrganizer ? (
        <DragDropProvider
          sensors={BOOKING_DND_SENSORS}
          onDragStart={dnd.handleDragStart}
          onDragEnd={dnd.handleDragEnd}
        >
          {calendarAndRail}
          <DragOverlay>
            {dnd.activeTemplate && (
              <DragOverlayPill
                label={dnd.activeTemplate.label}
                isAccent={dnd.activeTemplate.id === 'plus'}
              />
            )}
          </DragOverlay>
        </DragDropProvider>
      ) : (
        calendarAndRail
      )}

      <BookingQuickDetail
        booking={actions.detailBooking}
        onClose={actions.clearDetail}
        onAccept={actions.detailBooking?.reservationStatus === 'PendingAcceptance' ? actions.handleDetailAccept : undefined}
        onDecline={actions.detailBooking?.reservationStatus === 'PendingAcceptance' ? actions.handleDetailDecline : undefined}
        isAccepting={actions.isAccepting}
        isDeclining={actions.isDeclining}
        error={actions.detailError}
      />

      {actions.urgentCancelId && (
        <CancelBookingDialog
          open
          onClose={() => actions.setUrgentCancelId(null)}
          bookingId={actions.urgentCancelId as Id<'bookings'>}
          onSuccess={() => actions.setUrgentCancelId(null)}
        />
      )}

      {pendingToggle && (
        <BlockDateDialog pendingToggle={pendingToggle} isToggling={isToggling} onConfirm={confirmToggle} onCancel={cancelToggle} />
      )}

      {isOrganizer && (
        <BookingOverlay
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          initialCourses={overlayPreFill ? undefined : overlayCourses}
          initialPreFill={overlayPreFill}
          wizardKey={wizardKey}
        />
      )}
    </div>
  )
}
