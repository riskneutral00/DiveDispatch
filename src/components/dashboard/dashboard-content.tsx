'use client'

import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { DndContext, DragOverlay, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'
import { Anchor } from 'lucide-react'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { DASHBOARD_CONFIGS } from '@/lib/constants/dashboard-config'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { useOperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import { BookingCalendar } from '@/components/booking/booking-calendar'
import { BookingQuickDetail } from '@/components/booking/booking-quick-detail'
import { BookingOverlay } from '@/components/booking/booking-overlay'
import { QuickBookRail, COURSE_TEMPLATES, type PillDragData } from '@/components/booking/quick-book-rail'
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog'
import { GlassDialog, GlassButton } from '@/components/glass'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { useBlockedDateToggle } from '@/lib/hooks/use-blocked-date-toggle'
import { useDevSwitching } from '@/components/dev/dev-switch-context'
import { getEndDateDefault, calculateComboDates } from '@/lib/booking/course-validation'
import { api } from '../../../convex/_generated/api'
import type { BookingPreFill } from '@/lib/booking/wizard-state'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../convex/bookings'
import type { Id } from '../../../convex/_generated/dataModel'

const OPERATOR_TYPES = new Set<string>([
  'DiveCenter',
  'Agent',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
])

type OperatorType = 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel'

// ── Drop Confirmation Overlay ────────────────────────────────────────────────

interface DropConfirmation {
  label: string
  startDate: string
  endDate: string
  conflicts: Record<string, { slug: string; available: boolean }[]> | null
}

function DropConfirmOverlay({ info }: { info: DropConfirmation }) {
  const hasConflicts = info.conflicts && Object.values(info.conflicts).some(
    (arr) => arr.some((r) => !r.available),
  )

  return (
    <div
      className="glass-container glass-elevated rounded-lg px-3 py-2 text-xs animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ minWidth: 140, boxShadow: '0 4px 16px var(--color-glass-shadow-elevated)' }}
    >
      <div className="font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
        {info.label}
      </div>
      <div style={{ color: 'var(--color-text-secondary)' }}>
        {info.startDate === info.endDate ? info.startDate : `${info.startDate} — ${info.endDate}`}
      </div>
      {hasConflicts && (
        <div className="mt-1 flex items-center gap-1" style={{ color: 'var(--color-warning, #fbbf24)' }}>
          <span>Resource conflicts detected</span>
        </div>
      )}
      {info.conflicts && !hasConflicts && (
        <div className="mt-1" style={{ color: 'var(--color-status-active)' }}>
          All resources available
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function DashboardContent({
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

  // Operator defaults for pre-fill
  const { defaults } = useOperatorDefaults()

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

  // ── Booking overlay state ──────────────────────────────────────────────────

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

  // ── Drag-and-drop state ────────────────────────────────────────────────────

  const [isDragging, setIsDragging] = useState(false)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [dropConfirmation, setDropConfirmation] = useState<DropConfirmation | null>(null)
  const [armedPillId, setArmedPillId] = useState<string | null>(null)

  // Async availability check for drop confirmation
  const [availCheckDates, setAvailCheckDates] = useState<string[]>([])
  const preferredSlugs = useMemo(() => ({
    instructor: defaults.preferredInstructorSlug ? [defaults.preferredInstructorSlug] : [],
    venue: defaults.preferredVenueSlug ? [defaults.preferredVenueSlug] : [],
    boat: defaults.preferredBoatSlug ? [defaults.preferredBoatSlug] : [],
    equipment: defaults.preferredEquipmentSlug ? [defaults.preferredEquipmentSlug] : [],
    compressor: defaults.preferredCompressorSlug ? [defaults.preferredCompressorSlug] : [],
  }), [defaults])

  const availabilityResult = useQuery(
    api.availability.checkPreferredAvailability,
    availCheckDates.length > 0
      ? { dates: availCheckDates, preferredSlugs }
      : 'skip',
  )

  // When availability result comes back, update the confirmation overlay
  if (dropConfirmation && !dropConfirmation.conflicts && availabilityResult) {
    setDropConfirmation({ ...dropConfirmation, conflicts: availabilityResult })
  }

  function computeDateRange(courses: string[], startDate: string): { startDate: string; endDate: string } {
    if (courses.length === 0) return { startDate, endDate: startDate }

    // O+A combo
    if (courses.includes('OW') && courses.includes('AOW')) {
      const { aowDates } = calculateComboDates(startDate)
      return { startDate, endDate: aowDates[1] }
    }

    // Single or multiple sequential courses — take the max end date
    let maxEnd = startDate
    let currentStart = startDate
    for (const code of courses) {
      const end = getEndDateDefault(code, currentStart)
      if (end > maxEnd) maxEnd = end
      currentStart = end // chain sequential courses
    }
    return { startDate, endDate: maxEnd }
  }

  function buildPreFill(courses: string[], startDate: string): BookingPreFill {
    const { endDate } = computeDateRange(courses, startDate)
    return {
      courses,
      startDate,
      endDate,
      agency: defaults.agency,
      instructorSlug: defaults.preferredInstructorSlug,
      venueSlug: defaults.preferredVenueSlug,
      boatSlug: defaults.preferredBoatSlug,
      equipmentSlug: defaults.preferredEquipmentSlug,
      compressorSlug: defaults.preferredCompressorSlug,
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as PillDragData | undefined
    if (data?.type !== 'quick-book-pill') return
    setIsDragging(true)
    setDragLabel(data.label)
    setArmedPillId(null) // clear any armed state
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false)
    setDragLabel(null)

    const pillData = event.active.data.current as PillDragData | undefined
    const dropData = event.over?.data.current as { type: string; date: string } | undefined

    if (pillData?.type !== 'quick-book-pill' || dropData?.type !== 'calendar-date') return

    const date = dropData.date
    const courses = pillData.courses as string[]
    const preFill = buildPreFill(courses, date)

    // Compute all dates in range for availability check
    const dates: string[] = []
    const cur = new Date(preFill.startDate + 'T00:00:00')
    const end = new Date(preFill.endDate + 'T00:00:00')
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }

    // Show confirmation overlay + fire async availability check
    setDropConfirmation({
      label: pillData.label,
      startDate: preFill.startDate,
      endDate: preFill.endDate,
      conflicts: null,
    })
    setAvailCheckDates(dates)

    // Open wizard after brief delay (let confirmation flash)
    setTimeout(() => {
      openBookingOverlay(courses, preFill)
      // Clear confirmation after wizard opens
      setTimeout(() => setDropConfirmation(null), 300)
    }, 600)
  }

  function handleDragCancel() {
    setIsDragging(false)
    setDragLabel(null)
  }

  // ── Mobile tap-pill → tap-date flow ────────────────────────────────────────

  function handleArmedDateClick(date: string) {
    if (!armedPillId) {
      // No pill armed — normal date click (block/unblock)
      requestToggle(date)
      return
    }

    // Find the armed pill's courses
    const template = COURSE_TEMPLATES.find((t) => t.id === armedPillId)
    const courses = template?.courses ?? (armedPillId === 'plus' ? [] : [])
    const preFill = buildPreFill(courses as string[], date)

    // Show confirmation + open wizard
    setDropConfirmation({
      label: template?.label ?? '+ Booking',
      startDate: preFill.startDate,
      endDate: preFill.endDate,
      conflicts: null,
    })

    const dates: string[] = []
    const cur = new Date(preFill.startDate + 'T00:00:00')
    const end = new Date(preFill.endDate + 'T00:00:00')
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    setAvailCheckDates(dates)

    setArmedPillId(null)
    setTimeout(() => {
      openBookingOverlay(courses as string[], preFill)
      setTimeout(() => setDropConfirmation(null), 300)
    }, 600)
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

  const calendarContent = (
    <>
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
            <QuickBookRail
              onSelect={(courses) => openBookingOverlay(courses as string[])}
              armedPillId={armedPillId}
              onArmPill={setArmedPillId}
            />
          </div>
        )}
      </div>

      {/* Drop confirmation overlay */}
      {dropConfirmation && (
        <div className="flex justify-center">
          <DropConfirmOverlay info={dropConfirmation} />
        </div>
      )}

      {/* Skyline Calendar */}
      <BookingCalendar
        bookings={calendarBookings}
        blockedDates={blockedDates}
        onDateClick={isOrganizer ? handleArmedDateClick : requestToggle}
        onBookingClick={handleBookingClick}
        onRangeChange={handleRangeChange}
        onHiddenStatusesChange={setHiddenStatuses}
        onUrgentCancel={handleUrgentCancel}
        legendStatuses={legendStatuses as CalendarDisplayStatus[]}
        allDraftsUrgent={isResourceOnly}
        viewerRole={clerkRole}
        droppableEnabled={isOrganizer && isDragging}
      />
    </>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-3">

      {/* DndContext wraps pills + calendar for drag-to-date */}
      {isOrganizer ? (
        <DndContext
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {calendarContent}

          {/* Drag overlay — floating pill that follows cursor */}
          <DragOverlay>
            {dragLabel && (
              <div
                className="rounded-full px-3 py-1 font-medium text-xs shadow-lg"
                style={{
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-primary-glow)',
                  border: '2px solid var(--color-glass-border-hover)',
                  opacity: 0.9,
                }}
              >
                {dragLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        calendarContent
      )}

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
          initialCourses={overlayPreFill ? undefined : overlayCourses}
          initialPreFill={overlayPreFill}
          wizardKey={wizardKey}
        />
      )}
    </div>
  )
}
