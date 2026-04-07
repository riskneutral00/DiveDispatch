import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireAuth, assertOwnership } from '../lib/auth'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { BookingDoc, InventoryUnitDoc, AvailabilitySnapshotDoc } from '../lib/types'
import {
  type SessionInput,
  type SubmitToDraftArgs,
  type CourseCode,
  sessionValidator,
  bookingDataValidator,
  releaseBookingReservations,
  tryAutoAdvance,
  isFullDayResource,
  assertNoPastDates,
  getAvailabilitySnapshot,
} from './_shared'
import { logBookingChange } from '../lib/auditLog'
import { notifyReleasedInventory } from '../notifications'
import { deleteResourcesForBooking, insertBookingResource } from '../bookingResources'
import { ErrorCode } from '../lib/errorCodes'
import { profileBySlug } from '../lib/profileHelpers'
import type { Doc } from '../_generated/dataModel'
import { canTeachCourses, type Credential } from '../lib/credentialMatch'
import { normalizeTime } from '../lib/validators'
import { RESERVATION_STATUS, VACATED_REASON } from '../shared/statuses'
import { validateRatio } from '../shared/ratioRules'

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
export async function _handler(ctx: MutationCtx, args: SubmitToDraftArgs): Promise<string> {
  // 1. Auth
  const { user } = await requireAuth(ctx)

  // 2. Load booking + verify caller owns it
  // Referral bookings: DC is the owner — agent cannot submit even though agentId is set.
  const booking = await ctx.db.get(args.bookingId as Id<"bookings">)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  assertOwnership(booking as BookingDoc, user)

  // 3. Identify external resource types — these skip the reservation pipeline entirely.
  // A resource with externalName (no resourceId) is outside the system.
  // Sessions whose inventory unit's resourceType matches are skipped in STEP 1 and STEP 3.
  const resources = args.bookingData?.resources ?? []
  const externalResourceTypes = new Set<string>()
  for (const r of resources) {
    if (!r.resourceId && r.externalName) {
      externalResourceTypes.add(r.resourceType)
    }
  }

  // 4. Blocked dates — reject before touching inventory
  const blockedDateDocs = await ctx.db
    .query('stakeholderBlockedDates')
    .withIndex('by_stakeholderId_roleType', (q) => q.eq('stakeholderId', user.slug))
    .collect() // bounded: per-booking scope
  const allBlocked = new Set<string>(blockedDateDocs.flatMap((d) => d.dates as string[]))
  if (allBlocked.size > 0) {
    for (const session of args.sessions) {
      if (allBlocked.has(session.date)) throw new ConvexError({ code: ErrorCode.BLOCKED_DATE })
    }
  }

  // 4b. Past dates — reject sessions starting before today
  const tz = args.sessions[0]?.timezone ?? 'Asia/Bangkok'
  assertNoPastDates(args.sessions, tz)

  // 5. Instructor-to-student ratio — reject if insufficient staff (DD-304)
  // Only enforce when bookingData is provided (full submit with resources + divers).
  // Session-only resubmits don't carry resource info and can't be validated here.
  if (args.bookingData) {
    const diverCount = args.bookingData.divers.length
    // Use roleType (when provided) to distinguish DiveMasters from Instructors.
    // Callers that don't set roleType fall back to resourceType — both map to
    // Instructor-level capacity, preserving backward compatibility.
    const instructorResourceCount = resources.filter(
      (r) => r.resourceType === 'Instructor' && (r.roleType ?? 'Instructor') !== 'DiveMaster',
    ).length
    const dmCount = resources.filter(
      (r) => r.resourceType === 'Instructor' && r.roleType === 'DiveMaster',
    ).length
    const ratioResult = validateRatio(diverCount, instructorResourceCount, dmCount)
    if (!ratioResult.valid) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: ratioResult.message })
    }
  }

  // 6. Max non-confined dives per day — reject if any date exceeds 3
  const nonConfinedPerDate = new Map<string, number>()
  for (const session of args.sessions) {
    if (!session.diveSlots) continue
    for (const slot of session.diveSlots) {
      if (!slot.isConfined) {
        const count = nonConfinedPerDate.get(session.date) ?? 0
        nonConfinedPerDate.set(session.date, count + 1)
      }
    }
  }
  for (const [date, count] of nonConfinedPerDate) {
    if (count > 3) {
      throw new ConvexError({ code: ErrorCode.MAX_DIVES_EXCEEDED, date, count })
    }
  }

  // 6. Edit mode — vacate existing holds and delete old session rows
  const existingReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId as Id<"bookings">))
    .collect() // bounded: per-booking scope

  const isResubmit = existingReservations.length > 0

  if (isResubmit) {
    const vacated = await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.OperatorEdit)
    await notifyReleasedInventory(ctx, args.bookingId as Id<'bookings'>, vacated)
    const existingSessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId as Id<"bookings">))
      .collect() // bounded: per-booking scope
    for (const s of existingSessions) {
      await ctx.db.delete(s._id) // batch-exempt: sequential delete required; sessions must be removed before re-hold
    }
  }

  // Normalize time strings before any snapshot lookup or write (DD-260)
  const normalizedSessions: SessionInput[] = args.sessions.map((s) => ({
    ...s,
    startTime: normalizeTime(s.startTime),
    endTime: normalizeTime(s.endTime),
  }))

  // STEP 1: Read-only pass — build plans or throw CONFLICT (zero writes so far)
  type SessionPlan = {
    session: SessionInput
    inventoryUnit: InventoryUnitDoc
    snapshot: AvailabilitySnapshotDoc | null
    currentAvailable: number
  }

  const plans: SessionPlan[] = []

  for (const session of normalizedSessions) {
    const inventoryUnit = await ctx.db.get(session.inventoryUnitId as Id<"inventoryUnits">) as InventoryUnitDoc | null // batch-exempt: read-then-conflict-check must be sequential per inventory invariant
    if (!inventoryUnit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    // External resource — no inventory check or reservation row needed
    if (externalResourceTypes.has(inventoryUnit.resourceType as string)) continue

    // Full-day overlap check: day boats and liveaboards are blocked for the entire
    // calendar date when any reservation exists, regardless of time window.
    if (isFullDayResource(inventoryUnit)) {
      const allDaySnapshots = await ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date', (q) =>
          q.eq('inventoryUnitId', session.inventoryUnitId as Id<"inventoryUnits">).eq('date', session.date),
        )
        .collect() // bounded: per-booking scope
      for (const daySnap of allDaySnapshots) {
        if (daySnap.availableUnits <= 0) throw new ConvexError({ code: ErrorCode.CONFLICT })
      }
    }

    // Lazy snapshot: if no snapshot exists, treat totalUnits as fully available
    const snapshot = await getAvailabilitySnapshot(ctx, session.inventoryUnitId as Id<"inventoryUnits">, session.date, session.startTime)

    const currentAvailable: number = snapshot?.availableUnits ?? inventoryUnit.totalUnits

    // STEP 2: Any conflict aborts the entire mutation
    if (inventoryUnit.capacityModel === 'Exclusive') {
      if (session.unitsRequested !== 1) {
        throw new ConvexError({ code: ErrorCode.INVALID_INPUT, reason: 'Exclusive units require exactly 1 unit' })
      }
      if (currentAvailable < 1) throw new ConvexError({ code: ErrorCode.CONFLICT })
    } else {
      // Pooled — check requested units are available
      if (currentAvailable < session.unitsRequested) throw new ConvexError({ code: ErrorCode.CONFLICT })
    }

    plans.push({ session, inventoryUnit, snapshot: snapshot ?? null, currentAvailable })
  }

  // STEP 3: No conflicts detected — write everything atomically
  const now = Date.now()
  const expiresAt = now + ((booking as BookingDoc).holdTTL as number)

  for (const { session, inventoryUnit, snapshot, currentAvailable } of plans) {
    const newAvailable = currentAvailable - session.unitsRequested

    // Invariant 3: snapshot and reservation written in the same mutation
    // batch-exempt: snapshot + session + reservation must be written together per-plan to satisfy Invariant 3
    if (snapshot) {
      await ctx.db.patch(snapshot._id, { // batch-exempt: must write snapshot + reservation atomically per Invariant 3
        availableUnits: newAvailable,
        reservedUnits: (snapshot.reservedUnits as number) + session.unitsRequested,
      })
    } else {
      // Lazy creation: first time this unit+date+window is used
      await ctx.db.insert('availabilitySnapshots', { // batch-exempt: must write snapshot + reservation atomically per Invariant 3
        inventoryUnitId: session.inventoryUnitId as Id<"inventoryUnits">,
        date: session.date,
        windowStart: session.startTime,
        windowEnd: session.endTime,
        totalUnits: inventoryUnit.totalUnits,
        reservedUnits: session.unitsRequested,
        availableUnits: newAvailable,
      })
    }

    const sessionId = await ctx.db.insert('bookingSessions', { // batch-exempt: sessionId needed immediately for reservation FK
      bookingId: args.bookingId as Id<"bookings">,
      inventoryUnitId: session.inventoryUnitId as Id<"inventoryUnits">,
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
      .withIndex('by_stakeholderId', (q) =>
        q.eq('stakeholderId', inventoryUnit.ownerId),
      )
      .unique()

    const ownerUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', inventoryUnit.ownerId))
      .unique()

    const isSelfBooking = inventoryUnit.ownerId === (booking as BookingDoc).ownerId
    const isAutoAccept = prefs?.acceptanceMode === 'Auto' || !ownerUser || isSelfBooking
    const reservationStatus = isAutoAccept ? RESERVATION_STATUS.Confirmed : RESERVATION_STATUS.PendingAcceptance

    await ctx.db.insert('reservations', { // batch-exempt: depends on sessionId from insert above
      bookingId: args.bookingId as Id<"bookings">,
      inventoryUnitId: session.inventoryUnitId as Id<"inventoryUnits">,
      bookingSessionId: sessionId,
      unitsRequested: session.unitsRequested,
      status: reservationStatus,
      confirmedAt: isAutoAccept ? now : undefined,
    })
  }

  // Mark booking submitted and set TTL window.
  await ctx.db.patch(args.bookingId as Id<"bookings">, {
    submittedAt: now,
    expiresAt,
    bookingFormComplete: true,
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
  if (isResubmit) {
    await deleteResourcesForBooking(ctx, args.bookingId)
  }
  for (const r of resources) {
    await insertBookingResource(
      ctx,
      args.bookingId,
      r.resourceType,
      r.resourceId,
      r.externalName,
      r.roleType,
    )
  }

  // ── Instructor credential soft warning ──────────────────────────────────────
  // Collect all unique course codes from the booking's divers
  const bookingCourses: CourseCode[] = args.bookingData
    ? [...new Set(args.bookingData.divers.flatMap((d) => d.activityType))]
    : (booking as BookingDoc).activityType as CourseCode[]

  // Lead instructors only — Dive Masters use instructors table for capacity, not course credentials.
  const instructorResources = resources.filter(
    (r) =>
      r.resourceType === 'Instructor' &&
      r.resourceId &&
      (r.roleType ?? 'Instructor') !== 'DiveMaster',
  )

  const warnings: Array<{ type: string; missing: string[] }> = []

  for (const ir of instructorResources) { // batch-exempt: typically 1 instructor per booking
    const instructor = await profileBySlug(ctx, ir.resourceId!, 'instructors') as Doc<'instructors'> | null
    if (!instructor) continue

    const result = canTeachCourses(
      instructor.credential as Credential[],
      bookingCourses,
    )
    if (!result.canTeach) {
      warnings.push({ type: 'credential_gap', missing: result.missing })
    }
  }

  if (warnings.length > 0) {
    await ctx.db.patch(args.bookingId as Id<"bookings">, { warnings })
  }

  // Attempt Draft → Upcoming auto-advance (silent no-op if conditions not met)
  await tryAutoAdvance(ctx, args.bookingId)

  // ── Audit log ──────────────────────────────────────────────────────────────
  if (isResubmit && args.bookingData) {
    // Compute diff: compare stored booking fields vs new bookingData
    const diff: Record<string, { old: unknown; new: unknown }> = {}
    const scalarFields = [
      'startDate',
      'endDate',
      'agentId',
    ] as const
    for (const field of scalarFields) {
      const oldVal = (booking as Record<string, unknown>)[field]
      const newVal = (args.bookingData as Record<string, unknown>)[field]
      if (oldVal !== newVal) {
        diff[field] = { old: oldVal, new: newVal }
      }
    }
    if (Object.keys(diff).length > 0) {
      await logBookingChange(ctx, {
        bookingId: args.bookingId as Id<'bookings'>,
        action: 'edited',
        actorSlug: user.slug,
        actorType: 'operator',
        diff: JSON.stringify(diff),
      })
    }
  }

  await logBookingChange(ctx, {
    bookingId: args.bookingId as Id<'bookings'>,
    action: 'submitted',
    actorSlug: user.slug,
    actorType: 'operator',
  })

  return args.bookingId
}

// ─── Convex mutation export ───────────────────────────────────────────────────

export const submitToDraft = mutation({
  args: {
    bookingId: v.id('bookings'),
    sessions: v.array(sessionValidator),
    bookingData: v.optional(bookingDataValidator),
  },
  handler: _handler,
})
