'use client'

import { useCallback } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { Anchor } from 'lucide-react'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { DASHBOARD_CONFIGS } from '@/lib/constants/dashboard-config'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { useOperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { useBlockedDateToggle } from '@/lib/hooks/use-blocked-date-toggle'
import { useDevSwitching } from '@/components/dev/dev-switch-context'
import { useDragToDate } from '@/lib/hooks/use-drag-to-date'
import { useBookingActions } from '@/lib/hooks/use-booking-actions'
import { useQuickBookFlow } from '@/lib/hooks/use-quick-book-flow'
import { BookingCalendar } from '@/components/booking/booking-calendar'
import { BookingQuickDetail } from '@/components/booking/booking-quick-detail'
import { BookingOverlay } from '@/components/booking/booking-overlay'
import { QuickBookRail } from '@/components/booking/quick-book-rail'
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog'
import { DropConfirmOverlay } from '@/components/booking/drop-confirm-overlay'
import { BlockDateDialog } from '@/components/booking/block-date-dialog'
import { api } from '../../../convex/_generated/api'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../convex/bookings'
import type { Id } from '../../../convex/_generated/dataModel'

const OPERATOR_TYPES = new Set<string>(['DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel'])
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
  const isOperator = clerkRole ? OPERATOR_TYPES.has(clerkRole) : false

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


  // ── Extracted hooks ────────────────────────────────────────────────────────

  const quickBook = useQuickBookFlow(defaults)
  const drag = useDragToDate(
    defaults,
    (courses, preFill) => quickBook.openBookingOverlay(courses, preFill),
    () => quickBook.setArmedPillId(null),
  )
  const actions = useBookingActions()

  // ── Derived callbacks ──────────────────────────────────────────────────────

  const handleBookingClick = useCallback(
    (id: string) => actions.handleBookingClick(id, calendarBookings),
    [actions.handleBookingClick, calendarBookings],
  )

  const handleDateClick = useCallback(
    (date: string) => {
      if (isOrganizer) {
        quickBook.handleArmedDateClick(date, requestToggle, drag.setDropConfirmation, drag.setAvailCheckDates)
      } else {
        requestToggle(date)
      }
    },
    [isOrganizer, quickBook.handleArmedDateClick, requestToggle, drag.setDropConfirmation, drag.setAvailCheckDates],
  )

  const handleUrgentCancel = useCallback(
    (bookingId: string) => actions.handleUrgentCancel(bookingId, isOperator),
    [actions.handleUrgentCancel, isOperator],
  )

  // ── Calendar content (shared between DnD and non-DnD paths) ───────────────

  const calendarContent = (
    <>
      <div>
        <div className="flex items-center gap-3 mb-1">
          <RoleIcon size={26} style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-2xl font-bold flex-1" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            {convexUser?.businessName ?? roleConfig?.label ?? roleSlug} Dashboard
          </h1>
        </div>
        {isOrganizer && (
          <div className="mt-3">
            <QuickBookRail
              onSelect={(courses) => quickBook.openBookingOverlay(courses as string[])}
              armedPillId={quickBook.armedPillId}
              onArmPill={quickBook.setArmedPillId}
            />
          </div>
        )}
      </div>

      {drag.dropConfirmation && (
        <div className="flex justify-center">
          <DropConfirmOverlay info={drag.dropConfirmation} />
        </div>
      )}

      <BookingCalendar
        bookings={calendarBookings}
        blockedDates={blockedDates}
        onDateClick={handleDateClick}
        onBookingClick={handleBookingClick}
        onUrgentCancel={handleUrgentCancel}
        legendStatuses={legendStatuses as CalendarDisplayStatus[]}
        allDraftsUrgent={isResourceOnly}
        viewerRole={clerkRole}
        droppableEnabled={isOrganizer && drag.isDragging}
      />
    </>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {isOrganizer ? (
        <DndContext onDragStart={drag.handleDragStart} onDragEnd={drag.handleDragEnd} onDragCancel={drag.handleDragCancel}>
          {calendarContent}
          <DragOverlay>
            {drag.dragLabel && (
              <div
                className="rounded-full px-3 py-1 font-medium text-xs shadow-lg"
                style={{ color: 'var(--color-text-primary)', background: 'var(--color-primary-glow)', border: '2px solid var(--color-glass-border-hover)', opacity: 0.9 }}
              >
                {drag.dragLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        calendarContent
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
          open={quickBook.overlayOpen}
          onClose={quickBook.closeOverlay}
          initialCourses={quickBook.overlayPreFill ? undefined : quickBook.overlayCourses}
          initialPreFill={quickBook.overlayPreFill}
          wizardKey={quickBook.wizardKey}
        />
      )}
    </div>
  )
}
