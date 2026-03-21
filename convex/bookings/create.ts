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
  isFullDayResource,
  assertNoPastDates,
} from './_shared'
import { logBookingChange } from '../bookingAuditLog'
import { deleteResourcesForBooking, insertBookingResource } from '../bookingResources'

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
  // A resource with externalName (no resourceSlug) is outside the system.
  // Sessions whose inventory unit's resourceType matches are skipped in STEP 1 and STEP 3.
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

  // 4b. Past dates — reject sessions starting before today
  assertNoPastDates(args.sessions)

  // 5. Max non-confined dives per day — reject if any date exceeds 3
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
      throw new ConvexError({ code: 'MAX_DIVES_EXCEEDED', date, count })
    }
  }

  // 6. Edit mode — vacate existing holds and delete old session rows
  const existingReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
    .collect()

  const isResubmit = existingReservations.length > 0

  if (isResubmit) {
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

    // Full-day overlap check: day boats and liveaboards are blocked for the entire
    // calendar date when any reservation exists, regardless of time window.
    if (isFullDayResource(inventoryUnit)) {
      const allDaySnapshots = await ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date', (q: AnyCtx) =>
          q.eq('inventoryUnitId', session.inventoryUnitId).eq('date', session.date),
        )
        .collect()
      for (const daySnap of allDaySnapshots) {
        if (daySnap.availableUnits <= 0) throw new ConvexError({ code: 'CONFLICT' })
      }
    }

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
    await insertBookingResource(ctx, args.bookingId, r.resourceType, r.resourceSlug, r.externalName)
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
        bookingId: args.bookingId,
        action: 'edited',
        actorSlug: user.slug,
        actorType: 'operator',
        diff: JSON.stringify(diff),
      })
    }
  }

  if (!isResubmit) {
    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'created',
      actorSlug: user.slug,
      actorType: 'operator',
    })
  }

  await logBookingChange(ctx, {
    bookingId: args.bookingId,
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
