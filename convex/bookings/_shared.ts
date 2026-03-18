/**
 * Shared types, validators, state-machine guards, and helper functions for
 * booking mutations. Not a Convex file — exports no query/mutation/action
 * registrations. Import freely from any other convex/ file.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCtx = any

// ─── Types ────────────────────────────────────────────────────────────────────

export type VacatedReason =
  | 'booking_cancelled'
  | 'stakeholder_declined'
  | 'hold_expired'
  | 'operator_edit'
  | 'noshow_replacement'
  | 'equipment_not_needed'

export type CourseCode =
  | 'DSD'
  | 'TRY_DIVE'
  | 'OW'
  | 'AOW'
  | 'RESCUE'
  | 'DM'
  | 'FD'
  | 'REFRESH'
  | 'SPECIALTY'

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

export type BookingData = {
  activityType: CourseCode[]
  startDate: string
  endDate: string
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
  instructorId?: string
  boatId?: string
  equipmentManagerId?: string
  poolId?: string
  compressorId?: string
  agentId?: string
  agentIsReferral?: boolean
  externalStakeholders?: {
    instructorName?: string
    boatName?: string
    equipmentManagerName?: string
    poolName?: string
    compressorName?: string
  }
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

import { v } from 'convex/values'

export const courseCodeValidator = v.union(
  v.literal('DSD'),
  v.literal('TRY_DIVE'),
  v.literal('OW'),
  v.literal('AOW'),
  v.literal('RESCUE'),
  v.literal('DM'),
  v.literal('FD'),
  v.literal('REFRESH'),
  v.literal('SPECIALTY'),
)

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

export const bookingDataValidator = v.object({
  activityType: v.array(courseCodeValidator),
  startDate: v.string(),
  endDate: v.string(),
  portalContact: v.boolean(),
  portalMedical: v.boolean(),
  portalWaiver: v.boolean(),
  instructorId: v.optional(v.string()),
  boatId: v.optional(v.string()),
  equipmentManagerId: v.optional(v.string()),
  poolId: v.optional(v.string()),
  compressorId: v.optional(v.string()),
  agentId: v.optional(v.string()),
  agentIsReferral: v.optional(v.boolean()),
  externalStakeholders: v.optional(
    v.object({
      instructorName: v.optional(v.string()),
      boatName: v.optional(v.string()),
      equipmentManagerName: v.optional(v.string()),
      poolName: v.optional(v.string()),
      compressorName: v.optional(v.string()),
    }),
  ),
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
  action: 'accept' | 'vacate',
): boolean {
  switch (action) {
    case 'accept':
      return currentStatus === 'PendingAcceptance'
    case 'vacate':
      return currentStatus === 'PendingAcceptance' || currentStatus === 'Confirmed'
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Vacates all active (PendingAcceptance | Confirmed) reservations for a booking
 * and restores their corresponding AvailabilitySnapshot counts atomically.
 * Used by: edit mode re-submission, cancellation, TTL expiry.
 */
export async function releaseBookingReservations(
  ctx: AnyCtx,
  bookingId: string,
  reason: VacatedReason,
): Promise<void> {
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
    .collect()

  const active = reservations.filter(
    (r: AnyCtx) => r.status === 'PendingAcceptance' || r.status === 'Confirmed',
  )

  for (const res of active) {
    await ctx.db.patch(res._id, {
      status: 'Vacated',
      vacatedAt: Date.now(),
      vacatedBy: reason,
    })

    // Restore snapshot units using the linked booking session for window coordinates
    const session = await ctx.db.get(res.bookingSessionId)
    if (!session) continue

    const snapshot = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_inventoryUnitId_date_windowStart', (q: AnyCtx) =>
        q
          .eq('inventoryUnitId', res.inventoryUnitId)
          .eq('date', session.date)
          .eq('windowStart', session.startTime),
      )
      .unique()

    if (snapshot) {
      await ctx.db.patch(snapshot._id, {
        availableUnits: snapshot.availableUnits + res.unitsRequested,
        reservedUnits: Math.max(0, snapshot.reservedUnits - res.unitsRequested),
      })
    }
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
export async function tryAutoAdvance(ctx: AnyCtx, bookingId: string): Promise<void> {
  const booking = await ctx.db.get(bookingId)
  if (!booking || booking.status !== 'Draft') return
  if (!booking.bookingFormComplete || !booking.customerFormComplete) return
  if (booking.medicalHardBlock) return

  // ─── EM auto-release ──────────────────────────────────────────────────────
  // Release the EM reservation when every customer owns all their gear.
  // Requires: booking has an in-system EM, all customer profiles have submitted
  // rentalChecklist, and every gear type is 'own'. Missing checklist → keep hold.
  if (booking.equipmentManagerId) {
    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
      .collect()

    const allOwnGear =
      profiles.length > 0 &&
      profiles.every((p: AnyCtx) => {
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
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
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
            .withIndex('by_inventoryUnitId_date_windowStart', (q: AnyCtx) =>
              q
                .eq('inventoryUnitId', res.inventoryUnitId)
                .eq('date', session.date)
                .eq('windowStart', session.startTime),
            )
            .unique()
          if (snapshot) {
            await ctx.db.patch(snapshot._id, {
              availableUnits: snapshot.availableUnits + res.unitsRequested,
              reservedUnits: Math.max(0, snapshot.reservedUnits - res.unitsRequested),
            })
          }
        }
      }
    }
  }

  // ─── Reservation check ────────────────────────────────────────────────────
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
    .collect()

  const active = reservations.filter((r: AnyCtx) => r.status !== 'Vacated')

  // All in-system reservations must be Confirmed (vacuously true when all resources are external)
  if (active.every((r: AnyCtx) => r.status === 'Confirmed')) {
    await ctx.db.patch(bookingId, { status: 'Upcoming' })
  }
}

/**
 * Check whether a session's end time has passed in the session's local timezone.
 * Uses Intl.DateTimeFormat to compare current time against session end date/time.
 * Exported for unit testing.
 */
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
