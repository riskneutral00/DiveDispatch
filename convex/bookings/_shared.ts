/**
 * Shared types, validators, state-machine guards, and helper functions for
 * booking mutations. Not a Convex file — exports no query/mutation/action
 * registrations. Import freely from any other convex/ file.
 */

import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VacatedReason =
  | 'booking_cancelled'
  | 'stakeholder_declined'
  | 'hold_expired'
  | 'operator_edit'
  | 'noshow_replacement'
  | 'equipment_not_needed'

import { type CourseCode, courseCodeValidator } from '../shared/courseCodes'
export { type CourseCode, courseCodeValidator } from '../shared/courseCodes'

export type SessionInput = {
  inventoryUnitId: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  unitsRequested: number
  deliveryLocation?: 'BoatPier' | 'Pool' | 'Beach'
  diveSlots?: Array<{
    courseCode: CourseCode
    diveNumber: number
    isConfined: boolean
    diverIndex: number
  }>
}

export type BookingResourceInput = {
  resourceType: string
  resourceSlug?: string
  externalName?: string
}

export type BookingData = {
  activityType: CourseCode[]
  startDate: string
  endDate: string
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
  agentId?: string
  agentIsReferral?: boolean
  resources?: BookingResourceInput[]
  divers: Array<{
    name: string
    abbrev: string
    flag: { code: string; label: string }
    startDate: string
    endDate: string
    agency?: string
    activityType: CourseCode[]
  }>
}

export type SubmitToDraftArgs = {
  bookingId: string
  sessions: SessionInput[]
  bookingData?: BookingData
}

// ─── Validators ───────────────────────────────────────────────────────────────

import { ConvexError, v } from 'convex/values'
import { getResourcesForBooking } from '../bookingResources'


export const sessionValidator = v.object({
  inventoryUnitId: v.id('inventoryUnits'),
  date: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  timezone: v.string(),
  unitsRequested: v.number(),
  deliveryLocation: v.optional(
    v.union(v.literal('BoatPier'), v.literal('Pool'), v.literal('Beach')),
  ),
  diveSlots: v.optional(
    v.array(
      v.object({
        courseCode: courseCodeValidator,
        diveNumber: v.number(),
        isConfined: v.boolean(),
        diverIndex: v.number(),
      }),
    ),
  ),
})

export const bookingResourceInputValidator = v.object({
  resourceType: v.string(),
  resourceSlug: v.optional(v.string()),
  externalName: v.optional(v.string()),
})

export const bookingDataValidator = v.object({
  activityType: v.array(courseCodeValidator),
  startDate: v.string(),
  endDate: v.string(),
  portalContact: v.boolean(),
  portalMedical: v.boolean(),
  portalWaiver: v.boolean(),
  agentId: v.optional(v.string()),
  agentIsReferral: v.optional(v.boolean()),
  resources: v.optional(v.array(bookingResourceInputValidator)),
  divers: v.array(
    v.object({
      name: v.string(),
      abbrev: v.string(),
      flag: v.object({ code: v.string(), label: v.string() }),
      startDate: v.string(),
      endDate: v.string(),
      agency: v.optional(v.string()),
      activityType: v.array(courseCodeValidator),
    }),
  ),
})

// ─── State Machines ───────────────────────────────────────────────────────────

/**
 * Booking status transition guard. Returns true if the transition is valid.
 *
 * confirm: Draft only (auto-advance to Upcoming)
 * edit:    Upcoming | Completed (operator edit resets to Draft)
 * cancel:  Any non-Cancelled status
 * complete: Upcoming only (auto-complete cron)
 */
export function canBookingTransition(
  currentStatus: 'Draft' | 'Upcoming' | 'Completed' | 'Cancelled',
  action: 'confirm' | 'edit' | 'cancel' | 'complete',
): boolean {
  switch (action) {
    case 'confirm':
      return currentStatus === 'Draft'
    case 'edit':
      return currentStatus === 'Upcoming' || currentStatus === 'Completed'
    case 'cancel':
      return currentStatus !== 'Cancelled'
    case 'complete':
      return currentStatus === 'Upcoming'
    default:
      return false
  }
}

/**
 * Reservation status transition guard. Returns true if the transition is valid.
 *
 * accept: PendingAcceptance only
 * vacate: PendingAcceptance | Confirmed
 */
export function canReservationTransition(
  currentStatus: 'PendingAcceptance' | 'Confirmed' | 'Vacated' | 'NoShow',
  action: 'accept' | 'vacate' | 'mark_noshow' | 'revert_noshow',
): boolean {
  switch (action) {
    case 'accept':
      return currentStatus === 'PendingAcceptance'
    case 'vacate':
      return currentStatus === 'PendingAcceptance' || currentStatus === 'Confirmed'
    case 'mark_noshow':
      return currentStatus === 'Confirmed'
    case 'revert_noshow':
      return currentStatus === 'NoShow'
    default:
      return false
  }
}

// ─── Overlap granularity ──────────────────────────────────────────────────────

/**
 * Returns true if the inventory unit requires full-day overlap checking.
 *
 * Day boats and liveaboards go to one destination per day — a single reservation
 * blocks all other bookings on that calendar date regardless of time window.
 * All other resource types (speedboat, longtail, catamaran, rib, instructor,
 * equipment, etc.) use time-window granularity.
 *
 * Safe default: missing boatType → time-window (never over-blocks).
 */
export function isFullDayResource(inventoryUnit: {
  resourceType: string
  boatType?: string
}): boolean {
  return (
    inventoryUnit.resourceType === 'Boat' &&
    (inventoryUnit.boatType === 'day_boat' || inventoryUnit.boatType === 'liveaboard')
  )
}

// ─── Expiry helper ────────────────────────────────────────────────────────────

/**
 * Pure predicate: true when a Draft booking's hold TTL has lapsed.
 * Safe default: bookings without expiresAt never expire (treat as Upcoming-eligible).
 */
export function isBookingExpired(booking: {
  status: string
  expiresAt?: number | null
}): boolean {
  return booking.status === 'Draft' && booking.expiresAt != null && booking.expiresAt < Date.now()
}

// ─── Past-date guard ─────────────────────────────────────────────────────

/**
 * Throws ConvexError if any session date is before today (server-side, timezone-aware).
 * Uses the same Intl.DateTimeFormat pattern as isSessionEnded.
 */
export function assertNoPastDates(
  sessions: { date: string; timezone?: string }[],
  timezone = 'Asia/Bangkok',
): void {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(Date.now()).map((p) => [p.type, p.value]))
  const todayISO = `${parts.year}-${parts.month}-${parts.day}`

  for (const session of sessions) {
    if (session.date < todayISO) {
      throw new ConvexError({ code: 'PAST_DATE', date: session.date })
    }
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Restore availability snapshot when a reservation is released. */
export async function restoreSnapshotUnits(
  ctx: MutationCtx,
  snapshotId: Id<"availabilitySnapshots">,
  currentAvailable: number,
  currentReserved: number,
  unitsRequested: number,
) {
  await ctx.db.patch(snapshotId, {
    availableUnits: currentAvailable + unitsRequested,
    reservedUnits: Math.max(0, currentReserved - unitsRequested),
  })
}

/**
 * Vacates all active (PendingAcceptance | Confirmed) reservations for a booking
 * and restores their corresponding AvailabilitySnapshot counts atomically.
 * Used by: edit mode re-submission, cancellation, TTL expiry.
 */
export async function releaseBookingReservations(
  ctx: MutationCtx,
  bookingId: string,
  reason: VacatedReason,
): Promise<void> {
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()

  const active = reservations.filter(
    (r) => r.status === 'PendingAcceptance' || r.status === 'Confirmed',
  )

  for (const res of active) {
    await ctx.db.patch(res._id, {
      status: 'Vacated',
      vacatedAt: Date.now(),
      vacatedBy: reason,
    })

    // Restore snapshot units using the linked booking session for window coordinates
    const session = await ctx.db.get(res.bookingSessionId)
    if (!session) {
      throw new ConvexError({
        code: 'ORPHANED_RESERVATION',
        reason: `Reservation ${res._id} references missing session ${res.bookingSessionId}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    const snapshot = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
        q
          .eq('inventoryUnitId', res.inventoryUnitId)
          .eq('date', session.date)
          .eq('windowStart', session.startTime),
      )
      .unique()

    if (!snapshot) {
      throw new ConvexError({
        code: 'MISSING_SNAPSHOT',
        reason: `No availability snapshot found for unit ${res.inventoryUnitId} on ${session.date} at ${session.startTime}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    await restoreSnapshotUnits(ctx, snapshot._id, snapshot.availableUnits, snapshot.reservedUnits, res.unitsRequested)
  }
}

/**
 * Advances booking Draft → Upcoming when all conditions are simultaneously satisfied.
 * Silent no-op if any condition is unmet — callers never need to check.
 *
 * All-external bookings (zero in-system reservations) satisfy the reservation condition
 * vacuously — `[].every(fn)` is true — and advance immediately when form conditions are met.
 *
 * EM auto-release: if every customer profile has submitted a rentalChecklist with all
 * gear set to 'own', the Equipment Manager reservation is vacated automatically —
 * their services are not needed. This runs before the reservation confirmation check
 * so the now-vacated EM slot does not block advancement.
 */
export async function tryAutoAdvance(ctx: MutationCtx, bookingId: string): Promise<void> {
  const booking = await ctx.db.get(bookingId as Id<'bookings'>)
  if (!booking || booking.status !== 'Draft') return
  if (!booking.bookingFormComplete || !booking.customerFormComplete) return
  if (booking.medicalHardBlock) return

  // ─── EM auto-release ──────────────────────────────────────────────────────
  // Release the EM reservation when every customer owns all their gear.
  // Requires: booking has an in-system EM, all customer profiles have submitted
  // rentalChecklist, and every gear type is 'own'. Missing checklist → keep hold.
  const bookingResourceRows = await getResourcesForBooking(ctx, bookingId)
  const hasInSystemEM = bookingResourceRows.some(
    (r: { resourceType: string; resourceSlug?: string }) =>
      r.resourceType === 'Equipment' && r.resourceSlug,
  )
  if (hasInSystemEM) {
    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
      .collect()

    const allOwnGear =
      profiles.length > 0 &&
      profiles.every((p) => {
        if (!p.rentalChecklist) return false
        const c = p.rentalChecklist
        return (
          c.mask === 'own' &&
          c.bcd === 'own' &&
          c.wetsuit === 'own' &&
          c.fins === 'own' &&
          c.regulator === 'own'
        )
      })

    if (allOwnGear) {
      const allReservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
        .collect()

      for (const res of allReservations) {
        if (res.status === 'Vacated' || res.status === 'NoShow') continue
        const unit = await ctx.db.get(res.inventoryUnitId)
        if (!unit || unit.resourceType !== 'Equipment') continue

        await ctx.db.patch(res._id, {
          status: 'Vacated',
          vacatedAt: Date.now(),
          vacatedBy: 'equipment_not_needed',
        })

        // Restore availability snapshot — same pattern as releaseBookingReservations
        const session = await ctx.db.get(res.bookingSessionId)
        if (session) {
          const snapshot = await ctx.db
            .query('availabilitySnapshots')
            .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
              q
                .eq('inventoryUnitId', res.inventoryUnitId)
                .eq('date', session.date)
                .eq('windowStart', session.startTime),
            )
            .unique()
          if (snapshot) {
            await restoreSnapshotUnits(ctx, snapshot._id, snapshot.availableUnits, snapshot.reservedUnits, res.unitsRequested)
          }
        }
      }
    }
  }

  // ─── Reservation check ────────────────────────────────────────────────────
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()

  const active = reservations.filter((r) => r.status !== 'Vacated')
  // A declined resource (stakeholder_declined) means the booking is missing a required
  // resource and cannot advance. Vacated-for-other-reasons (equipment_not_needed) is fine.
  const hasDeclinedResource = reservations.some(
    (r) => r.status === 'Vacated' && r.vacatedBy === 'stakeholder_declined',
  )

  // All in-system reservations must be Confirmed.
  // Vacuously true when ALL resources are external (zero reservations ever created).
  // Blocked when a required resource was declined (needs operator attention).
  const allConfirmed = active.every((r) => r.status === 'Confirmed')

  if (allConfirmed && !hasDeclinedResource) {
    await ctx.db.patch(bookingId as Id<'bookings'>, { status: 'Upcoming' })
  }
}

/**
 * Check whether a session's end time has passed in the session's local timezone.
 * Uses Intl.DateTimeFormat to compare current time against session end date/time.
 * Exported for unit testing.
 */
/**
 * Computes the medical-block hold deadline per CLAUDE.md rules:
 *   Total 36h from booking creation, hard ceiling 8pm night before activity date.
 *   Returns whichever comes first as a Unix timestamp.
 */
export function computeMedicalDeadline(
  creationTime: number,
  earliestDate: string,
  timezone: string,
): number {
  const MEDICAL_TTL_MS = 36 * 60 * 60 * 1000
  const ttlDeadline = creationTime + MEDICAL_TTL_MS

  // 8pm night before the activity date in the session timezone.
  // Use Intl to derive the UTC offset for the timezone at ~that date.
  const [year, month, day] = earliestDate.split('-').map(Number)
  const refUTC = Date.UTC(year, month - 1, day - 1, 12, 0, 0)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  })
  const hourParts = formatter.formatToParts(refUTC)
  const hourStr = hourParts.find((p) => p.type === 'hour')?.value ?? '12'
  const localHour = parseInt(hourStr === '24' ? '0' : hourStr, 10)
  const utcOffsetHours = localHour - 12

  // 20:00 local = (20 - offset) UTC. Date.UTC handles hour overflow correctly.
  const deadline8pm = Date.UTC(year, month - 1, day - 1, 20 - utcOffsetHours, 0, 0)

  return Math.min(ttlDeadline, deadline8pm)
}

export function isSessionEnded(date: string, endTime: string, timezone: string): boolean {
  const now = Date.now()

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]))
  const currentDate = `${parts.year}-${parts.month}-${parts.day}`
  // hour12: false can emit '24' for midnight in some runtimes
  const hour = parts.hour === '24' ? '00' : parts.hour
  const currentTime = `${hour}:${parts.minute}`

  if (currentDate > date) return true
  if (currentDate === date && currentTime >= endTime) return true
  return false
}
