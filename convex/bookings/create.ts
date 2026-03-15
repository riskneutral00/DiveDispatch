import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireAuth } from '../lib/auth'
import {
  type AnyCtx,
  type SessionInput,
  type SubmitToDraftArgs,
  sessionValidator,
  bookingDataValidator,
  releaseBookingReservations,
  tryAutoAdvance,
} from './_shared'

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

  // 3. Identify external resource types — these skip the reservation pipeline entirely.
  // An external resource has a freeform name but no in-system ID on the booking.
  // Sessions whose inventory unit's resourceType matches are skipped in STEP 1 and STEP 3.
  // Prefer bookingData (new wizard state) over the stored booking fields for this check,
  // since createDraftShell creates a bare-bones booking with no resource IDs set.
  const resolvedExt = args.bookingData?.externalStakeholders ??
    (booking.externalStakeholders as Record<string, string | undefined> | undefined)
  const resolvedInstructorId = args.bookingData?.instructorId ?? booking.instructorId
  const resolvedBoatId = args.bookingData?.boatId ?? booking.boatId
  const resolvedEquipmentManagerId = args.bookingData?.equipmentManagerId ?? booking.equipmentManagerId
  const resolvedPoolId = args.bookingData?.poolId ?? booking.poolId
  const resolvedCompressorId = args.bookingData?.compressorId ?? booking.compressorId

  const externalResourceTypes = new Set<string>()
  if (!resolvedInstructorId && resolvedExt?.instructorName) externalResourceTypes.add('Instructor')
  if (!resolvedBoatId && resolvedExt?.boatName) externalResourceTypes.add('Boat')
  if (!resolvedEquipmentManagerId && resolvedExt?.equipmentManagerName) externalResourceTypes.add('Equipment')
  if (!resolvedPoolId && resolvedExt?.poolName) externalResourceTypes.add('Pool')
  if (!resolvedCompressorId && resolvedExt?.compressorName) externalResourceTypes.add('Compressor')

  // 4. Blocked dates — reject before touching inventory
  if (user.blockedDates && user.blockedDates.length > 0) {
    const blocked = new Set<string>(user.blockedDates as string[])
    for (const session of args.sessions) {
      if (blocked.has(session.date)) throw new ConvexError({ code: 'BLOCKED_DATE' })
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

    // Auto-confirm if stakeholder has opted into Auto acceptance mode
    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q: AnyCtx) =>
        q.eq('stakeholderId', inventoryUnit.ownerId),
      )
      .unique()

    const isAutoAccept = prefs?.acceptanceMode === 'Auto'
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
  // When bookingData is provided, persist the operator-supplied fields so the booking
  // record reflects the actual wizard values (not the bare createDraftShell defaults).
  await ctx.db.patch(args.bookingId, {
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
      instructorId: args.bookingData.instructorId,
      boatId: args.bookingData.boatId,
      equipmentManagerId: args.bookingData.equipmentManagerId,
      poolId: args.bookingData.poolId,
      compressorId: args.bookingData.compressorId,
      agentId: args.bookingData.agentId,
      agentIsReferral: args.bookingData.agentIsReferral,
      externalStakeholders: args.bookingData.externalStakeholders,
      divers: args.bookingData.divers,
    }),
  })

  // Attempt Draft → Upcoming auto-advance (silent no-op if conditions not met)
  await tryAutoAdvance(ctx, args.bookingId)

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
