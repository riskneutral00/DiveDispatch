'use client'

import { useCallback, useEffect, useState } from 'react'
import { DragDropProvider, DragOverlay } from '@dnd-kit/react'

import { ROLE_BY_KEY, ORGANIZER_ROLE_KEYS, type RoleKey, type RoleConfig } from '@/lib/constants/roles'
import { DASHBOARD_CONFIGS, DEFAULT_LEGEND_STATUSES } from '@/lib/constants/dashboard-config'
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
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { QuickBookRail } from '@/components/booking/quick-book-rail'
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog'
import { BlockDateDialog } from '@/components/booking/block-date-dialog'
import { DragOverlayPill } from '@/components/booking/drag-overlay-pill'
import { DiverEquipmentWidget } from '@/components/booking/diver-equipment-widget'
import { VesselCalendar } from '@/components/booking/vessel-calendar'
import { BoatManifestWidget } from '@/components/booking/boat-manifest-widget'
import { PendingRequestsList } from '@/components/booking/pending-requests-list'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { api } from '@/lib/convex-generated'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../convex/bookings'
import type { Id } from '@/lib/convex-generated'
import type { BookingPreFill } from '@/lib/booking/wizard-state'

// Mirrors the Convex listByOwner validator union — kept in sync with convex/bookings.ts:670
type OperatorType = 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel'

// ── Main Component ──────────────────────────────────────────────────────────

export function DashboardContent({ roleSlug, slug }: { roleSlug: string; slug: string }) {
  const roleConfig = ROLE_BY_KEY[roleSlug as RoleKey]

  // Guard: unknown roleSlug means roleConfig is undefined — bail before hooks
  // to prevent empty-string StakeholderRole reaching Convex validators.
  if (!roleConfig) return null

  return <DashboardContentInner roleConfig={roleConfig} slug={slug} roleSlug={roleSlug} />
}

// ── Inner Component (all hooks live here) ───────────────────────────────────

interface DashboardContentInnerProps {
  roleConfig: RoleConfig
  slug: string
  roleSlug: string
}

function DashboardContentInner({ roleConfig, slug, roleSlug }: DashboardContentInnerProps) {
  const { user: convexUser } = useCurrentUser()
  const RoleIcon = roleConfig.icon
  const isOrganizer = roleConfig.isOrganizer
  const isResourceOnly = roleConfig.isResource && !isOrganizer
  const clerkRole = roleConfig.clerkRole
  const dashConfig = DASHBOARD_CONFIGS[roleSlug]
  const isOperator = ORGANIZER_ROLE_KEYS.has(clerkRole)

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
  const { data: bookingTemplates } = useStableQuery(
    api.bookingTemplates.list,
    isOperator && clerkRole && !isSwitching ? { activeRole: clerkRole } : 'skip',
  )
  const calendarBookings: CalendarBooking[] = isOperator ? (bookings ?? []) : (dashboardData?.bookings ?? [])
  const legendStatuses = dashConfig?.legendStatuses ?? DEFAULT_LEGEND_STATUSES

  const { blockedDates, pendingToggle, requestToggle, confirmToggle, cancelToggle, isToggling } =
    useBlockedDateToggle({ ownerSlug: slug, roleType: clerkRole })

  const isEquipmentRole = clerkRole === 'Equipment'
  const isBoatRole = clerkRole === 'Boat'

  // Calendar visible range — drives DiverEquipmentWidget / BoatManifestWidget date window
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null)
  const handleRangeChange = useCallback((start: string, end: string) => {
    setVisibleRange({ start, end })
  }, [])

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

  const resolveTemplateResourceHints = useCallback(
    (courses: string[]) => {
      if (!bookingTemplates?.length) return undefined
      const key = [...courses].sort().join('\0')
      const match = bookingTemplates.find(
        (t) => [...t.activityType].sort().join('\0') === key,
      )
      return match?.resources?.map((r) => ({
        resourceType: r.resourceType,
        resourceSlug: r.resourceSlug,
      }))
    },
    [bookingTemplates],
  )

  const dnd = useBookingDnd({ defaults, resolveTemplateResourceHints })

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

  // Boat operator: vessel calendar + manifest data
  const { data: vesselCalendarData } = useStableQuery(
    api.boatWidget.getVesselCalendarData,
    isBoatRole && visibleRange && !isSwitching
      ? { dateRangeStart: visibleRange.start, dateRangeEnd: visibleRange.end }
      : 'skip',
  )

  const calendarAndRail = isBoatRole ? (
    <VesselCalendar
      data={vesselCalendarData}
      onRangeChange={handleRangeChange}
    />
  ) : (
    <>
      {isOrganizer && (
        <div className="mt-3">
          <QuickBookRail
            onSelect={(courses) => openBookingOverlay(courses as string[])}
            dragEnabled={isOrganizer}
          />
        </div>
      )}

      <BookingCalendar
        bookings={calendarBookings}
        blockedDates={blockedDates}
        onDateClick={requestToggle}
        onBookingClick={handleBookingClick}
        onUrgentCancel={handleUrgentCancel}
        onRangeChange={isEquipmentRole ? handleRangeChange : undefined}
        legendStatuses={legendStatuses as CalendarDisplayStatus[]}
        allDraftsUrgent={isResourceOnly}
        viewerRole={clerkRole}
        droppableEnabled={isOrganizer}
      />
    </>
  )

  return (
    <DashboardPageFrame
      maxWidth="4xl"
      padding="none"
      className="space-y-3"
      leading={<RoleIcon size={26} style={{ color: 'var(--color-primary)' }} />}
      title={`${convexUser?.businessName ?? roleConfig.label} Dashboard`}
    >
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

      {isResourceOnly && (
        <div className="space-y-2">
          <FormSectionHeader label="Pending Requests" />
          <PendingRequestsList requests={dashboardData?.requests ?? []} />
        </div>
      )}

      {isEquipmentRole && visibleRange && (
        <div className="space-y-2">
          <FormSectionHeader label="Diver Equipment" />
          <DiverEquipmentWidget visibleRange={visibleRange} />
        </div>
      )}

      {isBoatRole && visibleRange && (
        <div className="space-y-2">
          <FormSectionHeader label="Passenger Manifest" />
          <BoatManifestWidget visibleRange={visibleRange} />
        </div>
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
    </DashboardPageFrame>
  )
}
