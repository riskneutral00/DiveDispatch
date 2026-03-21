 import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import { requireAuth } from './lib/auth'
import { validateOrThrow } from './lib/validate'
import { deleteResourcesForBooking, insertBookingResource } from './bookingResources'
import { z } from 'zod'

// ─── Inline session schema (convex/ cannot import from src/) ─────────────────
// Mirrors bookingSessionsSchema but without the min(1) count so that all-external
// bookings (sessions: []) continue to pass.
const serverSessionSchema = z
  .object({
    inventoryUnitId: z.string().min(1, 'Inventory unit required'),
    date: z.string().min(1, 'Date required'),
    startTime: z.string().min(1, 'Start time required'),
    endTime: z.string().min(1, 'End time required'),
    timezone: z.string().min(1, 'Timezone required'),
    unitsRequested: z.number().int().min(1, 'Units must be at least 1'),
    deliveryLocation: z.enum(['BoatPier', 'Pool', 'Beach']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time must be after start time',
      })
    }
  })

const serverSessionsSchema = z.array(serverSessionSchema)

// ─── Types ────────────────────────────────────────────────────────────────────

type VacatedReason =
  | 'booking_cancelled'
  | 'stakeholder_declined'
  | 'hold_expired'
  | 'operator_edit'
  | 'noshow_replacement'

type CourseCode =
  | 'DSD'
  | 'TRY_DIVE'
  | 'OW'
  | 'AOW'
  | 'RESCUE'
  | 'DM'
  | 'FD'
  | 'REFRESH'
  | 'SPECIALTY'

type SessionInput = {
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

type BookingResourceInput = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

// ─── Validators ───────────────────────────────────────────────────────────────

const courseCodeValidator = v.union(
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

const sessionValidator = v.object({
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

const bookingResourceInputValidator = v.object({
  resourceType: v.string(),
  resourceSlug: v.optional(v.string()),
  externalName: v.optional(v.string()),
})

const bookingDataValidator = v.object({
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
 */
export async function tryAutoAdvance(ctx: AnyCtx, bookingId: string): Promise<void> {
  const booking = await ctx.db.get(bookingId)
  if (!booking || booking.status !== 'Draft') return
  if (!booking.bookingFormComplete || !booking.customerFormComplete) return
  if (booking.medicalHardBlock) return

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

// ─── submitToDraft ────────────────────────────────────────────────────────────

/**
 * Core implementation — exported for unit testing.
 *
 * THE critical invariant-enforcement mutation:
 *   1. Reads all availability snapshots (STEP 1)
 *   2. If ANY conflict → throws CONFLICT, zero writes (STEP 2)
 *   3. Writes reservations + decrements snapshots atomically (STEP 3)
 *
 * All three inventory invariants are enforced:
 *   Invariant 1: Exclusive unit — availableUnits must be ≥ 1
 *   Invariant 2: Pooled unit — availableUnits must be ≥ unitsRequested
 *   Invariant 3: Snapshot updates occur in the same mutation as Reservation writes
 */
export async function _handler(ctx: AnyCtx, args: SubmitToDraftArgs): Promise<string> {
  // 1. Auth
  const { user } = await requireAuth(ctx)

  // 2. Load booking + verify caller owns it
  // Referral bookings: DC is the owner — agent cannot submit even though agentId is set.
  const booking = await ctx.db.get(args.bookingId)
  if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
  if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  // 2a. Server-side session structural validation.
  // Does NOT enforce min(1) count — all-external bookings submit with sessions: [].
  // Resource presence and session count are enforced client-side before reaching here.
  validateOrThrow(serverSessionsSchema, args.sessions)

  // 3. Identify external resource types — these skip the reservation pipeline entirely.
  const resources = args.bookingData?.resources ?? []
  const externalResourceTypes = new Set<string>()
  for (const r of resources) {
    if (!r.resourceSlug && r.externalName) {
      externalResourceTypes.add(r.resourceType)
    }
  }

  // 4. Blocked dates — reject before touching inventory
  const blockedDateDocs = await ctx.db
    .query('stakeholderBlockedDates')
    .withIndex('by_ownerSlug_roleType', (q: AnyCtx) => q.eq('ownerSlug', user.slug))
    .collect()
  const allBlocked = new Set<string>(blockedDateDocs.flatMap((d: AnyCtx) => d.dates as string[]))
  if (allBlocked.size > 0) {
    for (const session of args.sessions) {
      if (allBlocked.has(session.date)) throw new ConvexError({ code: 'BLOCKED_DATE' })
    }
  }

  // 5. Edit mode — vacate existing holds and delete old session rows
  const existingReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
    .collect()

  if (existingReservations.length > 0) {
    await releaseBookingReservations(ctx, args.bookingId, 'operator_edit')
    const existingSessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const s of existingSessions) {
      await ctx.db.delete(s._id)
    }
  }

  // STEP 1: Read-only pass — build plans or throw CONFLICT (zero writes so far)
  type SessionPlan = {
    session: SessionInput
    inventoryUnit: {
      _id: string
      capacityModel: 'Exclusive' | 'Pooled'
      totalUnits: number
      ownerId: string
    }
    snapshot: {
      _id: string
      availableUnits: number
      reservedUnits: number
    } | null
    currentAvailable: number
  }

  const plans: SessionPlan[] = []

  for (const session of args.sessions) {
    const inventoryUnit = await ctx.db.get(session.inventoryUnitId)
    if (!inventoryUnit) throw new ConvexError({ code: 'NOT_FOUND' })

    // External resource — no inventory check or reservation row needed
    if (externalResourceTypes.has(inventoryUnit.resourceType as string)) continue

    // Lazy snapshot: if no snapshot exists, treat totalUnits as fully available
    const snapshot = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_inventoryUnitId_date_windowStart', (q: AnyCtx) =>
        q
          .eq('inventoryUnitId', session.inventoryUnitId)
          .eq('date', session.date)
          .eq('windowStart', session.startTime),
      )
      .unique()

    const currentAvailable: number = snapshot?.availableUnits ?? inventoryUnit.totalUnits

    // STEP 2: Any conflict aborts the entire mutation
    if (inventoryUnit.capacityModel === 'Exclusive') {
      if (currentAvailable < 1) throw new ConvexError({ code: 'CONFLICT' })
    } else {
      // Pooled — check requested units are available
      if (currentAvailable < session.unitsRequested) throw new ConvexError({ code: 'CONFLICT' })
    }

    plans.push({ session, inventoryUnit, snapshot: snapshot ?? null, currentAvailable })
  }

  // STEP 3: No conflicts detected — write everything atomically
  const now = Date.now()
  const expiresAt = now + (booking.holdTTL as number)

  for (const { session, inventoryUnit, snapshot, currentAvailable } of plans) {
    const newAvailable = currentAvailable - session.unitsRequested

    // Invariant 3: snapshot and reservation written in the same mutation
    if (snapshot) {
      await ctx.db.patch(snapshot._id, {
        availableUnits: newAvailable,
        reservedUnits: (snapshot.reservedUnits as number) + session.unitsRequested,
      })
    } else {
      // Lazy creation: first time this unit+date+window is used
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: session.inventoryUnitId,
        date: session.date,
        windowStart: session.startTime,
        windowEnd: session.endTime,
        totalUnits: inventoryUnit.totalUnits,
        reservedUnits: session.unitsRequested,
        availableUnits: newAvailable,
      })
    }

    const sessionId = await ctx.db.insert('bookingSessions', {
      bookingId: args.bookingId,
      inventoryUnitId: session.inventoryUnitId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      timezone: session.timezone,
      deliveryLocation: session.deliveryLocation,
      diveSlots: session.diveSlots,
    })

    // Auto-confirm: stakeholder preference, out-of-system owner, or self-booking
    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q: AnyCtx) =>
        q.eq('stakeholderId', inventoryUnit.ownerId),
      )
      .unique()

    const ownerUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', inventoryUnit.ownerId))
      .unique()

    const isSelfBooking = inventoryUnit.ownerId === booking.ownerId
    const isAutoAccept = prefs?.acceptanceMode === 'Auto' || !ownerUser || isSelfBooking
    const reservationStatus = isAutoAccept ? 'Confirmed' : 'PendingAcceptance'

    await ctx.db.insert('reservations', {
      bookingId: args.bookingId,
      inventoryUnitId: session.inventoryUnitId,
      bookingSessionId: sessionId,
      unitsRequested: session.unitsRequested,
      status: reservationStatus,
      confirmedAt: isAutoAccept ? now : undefined,
      expiresAt,
    })
  }

  // Mark booking submitted and set TTL window.
  // draftState is cleared on submit — it's only needed for resume-in-progress.
  await ctx.db.patch(args.bookingId, {
    submittedAt: now,
    expiresAt,
    bookingFormComplete: true,
    draftState: undefined,
    ...(args.bookingData && {
      activityType: args.bookingData.activityType,
      startDate: args.bookingData.startDate,
      endDate: args.bookingData.endDate,
      portalContact: args.bookingData.portalContact,
      portalMedical: args.bookingData.portalMedical,
      portalWaiver: args.bookingData.portalWaiver,
      agentId: args.bookingData.agentId,
      agentIsReferral: args.bookingData.agentIsReferral,
      divers: args.bookingData.divers,
    }),
  })

  // ── Write bookingResources junction table ───────────────────────────────
  const isResubmit = existingReservations.length > 0
  if (isResubmit) {
    await deleteResourcesForBooking(ctx, args.bookingId)
  }
  for (const r of resources) {
    await insertBookingResource(ctx, args.bookingId, r.resourceType, r.resourceSlug, r.externalName)
  }

  // Attempt Draft → Upcoming auto-advance (silent no-op if conditions not met)
  await tryAutoAdvance(ctx, args.bookingId)

  return args.bookingId
}

// ─── Convex mutation exports ──────────────────────────────────────────────────

export const submitToDraft = mutation({
  args: {
    bookingId: v.id('bookings'),
    sessions: v.array(sessionValidator),
    bookingData: v.optional(bookingDataValidator),
  },
  handler: _handler,
})

/**
 * Cancels a booking from any non-Cancelled status.
 * Vacates all active reservations and marks booking Cancelled. Irreversible.
 */
export const cancelBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx: AnyCtx, args: { bookingId: string }) => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

    if (!canBookingTransition(booking.status, 'cancel')) {
      throw new ConvexError({
        code: 'INVALID_STATUS',
        reason: `Cannot cancel booking in status '${booking.status}'`,
      })
    }

    await releaseBookingReservations(ctx, args.bookingId, 'booking_cancelled')
    await ctx.db.patch(args.bookingId, { status: 'Cancelled' })
  },
})

/**
 * Resets an Upcoming or Completed booking to Draft for editing.
 * Vacates all reservations, clears sessions, and marks bookingFormComplete false.
 */
export const editBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx: AnyCtx, args: { bookingId: string }) => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

    if (!canBookingTransition(booking.status, 'edit')) {
      throw new ConvexError({
        code: 'INVALID_STATUS',
        reason: `Cannot edit booking in status '${booking.status}'`,
      })
    }

    await releaseBookingReservations(ctx, args.bookingId, 'operator_edit')

    // Clear sessions so operator can re-submit with new session data
    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }

    await ctx.db.patch(args.bookingId, {
      status: 'Draft',
      bookingFormComplete: false,
      submittedAt: undefined,
      expiresAt: undefined,
    })
  },
})

// ─── TTL expiry cron ──────────────────────────────────────────────────────────

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

/**
 * Cron: expire Draft bookings whose holdTTL has lapsed.
 * Runs every 15 minutes. Vacates reservations then hard-deletes the booking.
 * Batch limit: 100 per run.
 */
export const expireHolds = internalMutation({
  args: {},
  handler: async (ctx: AnyCtx): Promise<{ expired: number; more: boolean }> => {
    const now = Date.now()

    const drafts = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q: AnyCtx) => q.eq('status', 'Draft'))
      .collect()

    const expired = drafts.filter(
      (b: AnyCtx) => b.expiresAt != null && b.expiresAt < now,
    )

    const batch = expired.slice(0, 100)
    const more = expired.length > 100

    for (const booking of batch) {
      await releaseBookingReservations(ctx, booking._id, 'hold_expired')

      const sessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', booking._id))
        .collect()
      for (const session of sessions) {
        await ctx.db.delete(session._id)
      }

      const links = await ctx.db
        .query('bookingLinks')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', booking._id))
        .collect()
      for (const link of links) {
        await ctx.db.delete(link._id)
      }

      await ctx.db.delete(booking._id)
    }

    return { expired: batch.length, more }
  },
})

/**
 * Cron: auto-complete Upcoming bookings whose last session has ended.
 * Runs hourly. Uses timezone-aware comparison via Intl.DateTimeFormat.
 * Batch limit: 100 per run.
 */
export const completeBookings = internalMutation({
  args: {},
  handler: async (ctx: AnyCtx): Promise<{ completed: number; more: boolean }> => {
    const upcoming = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q: AnyCtx) => q.eq('status', 'Upcoming'))
      .collect()

    const batch = upcoming.slice(0, 100)
    const more = upcoming.length > 100
    let completed = 0

    for (const booking of batch) {
      const sessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', booking._id))
        .collect()

      if (sessions.length === 0) continue

      // Last session = max date, then max endTime (both YYYY-MM-DD / HH:MM are lex-sortable)
      const last = sessions.reduce((latest: AnyCtx, s: AnyCtx) => {
        if (s.date > latest.date) return s
        if (s.date === latest.date && s.endTime > latest.endTime) return s
        return latest
      })

      if (isSessionEnded(last.date, last.endTime, last.timezone)) {
        await ctx.db.patch(booking._id, { status: 'Completed' })
        completed++
      }
    }

    return { completed, more }
  },
})
