import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireAuth, assertOwnership } from './lib/auth'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { tryAutoAdvance, restoreSnapshotUnits, canReservationTransition, isActiveReservation, getAvailabilitySnapshot } from './bookings/_shared'
import { deleteResourceByType } from './bookingResources'

import { type ResourceOwnerType as ResourceType } from './shared/resourceOwnerTypes'
import { getDatesInRange } from './shared/dateRange'
import { notify } from './notifications'
import { logBookingChange } from './bookingAuditLog'
import { ErrorCode } from './lib/errorCodes'
import { NOSHOW_REVERT_WINDOW_MS } from './lib/timeConstants'
import { BOOKING_STATUS, RESERVATION_STATUS, NOTIFICATION_TYPE, VACATED_REASON, type ReservationStatus } from './shared/statuses'

// Re-export for test backwards compatibility
export { getDatesInRange as getDateRange } from './shared/dateRange'

/** Maximum number of candidates evaluated during alternative resource search. */
export const MAX_CANDIDATES = 20

/**
 * Looks up the placeName for a single owner via their role-specific profile table.
 * Used by the decline handler for the declined unit itself.
 */
async function getOwnerCity(
  ctx: MutationCtx,
  ownerSlug: string,
  ownerType: ResourceType,
): Promise<string | null> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_slug', (q) => q.eq('slug', ownerSlug))
    .unique()
  if (!user) return null

  return getProfileCity(ctx, user._id, ownerType)
}

/**
 * Fetches the placeName from the profile table for a given userId and resource type.
 */
async function getProfileCity(
  ctx: MutationCtx,
  userId: Id<'users'>,
  ownerType: ResourceType,
): Promise<string | null> {
  let profile: { placeName?: string } | null = null

  if (ownerType === 'Instructor') {
    profile = await ctx.db
      .query('instructors')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  } else if (ownerType === 'Boat') {
    profile = await ctx.db
      .query('boats')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  } else if (ownerType === 'Equipment') {
    profile = await ctx.db
      .query('equipment')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  } else if (ownerType === 'Pool') {
    profile = await ctx.db
      .query('venues')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  } else if (ownerType === 'Compressor') {
    profile = await ctx.db
      .query('compressors')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  }

  return profile?.placeName ?? null
}

/**
 * Batch-fetches cities for multiple owner slugs in parallel.
 * Returns Map<slug, city | null>. All user lookups and profile lookups
 * happen via Promise.all — O(slugs) parallel queries, not sequential.
 */
export async function batchGetOwnerCities(
  ctx: MutationCtx,
  slugs: string[],
  ownerType: ResourceType,
): Promise<Map<string, string | null>> {
  const cityMap = new Map<string, string | null>()
  if (slugs.length === 0) return cityMap

  // Step 1: fetch all users by slug in parallel
  const users = await Promise.all(
    slugs.map((slug) =>
      ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique(),
    ),
  )

  // Step 2: fetch all profiles in parallel using the resolved user IDs
  const cities = await Promise.all(
    users.map((user) =>
      user ? getProfileCity(ctx, user._id, ownerType) : Promise.resolve(null),
    ),
  )

  // Step 3: assemble the map
  for (let i = 0; i < slugs.length; i++) {
    cityMap.set(slugs[i], cities[i])
  }

  return cityMap
}

// ─── acceptReservation ────────────────────────────────────────────────────────

/**
 * Core implementation — exported for unit testing.
 *
 * Transitions a PendingAcceptance reservation to Confirmed.
 * Idempotent: already-Confirmed reservations return early.
 * Calls tryAutoAdvance in case this was the last pending reservation.
 */
export async function _acceptHandler(
  ctx: MutationCtx,
  args: { reservationId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const reservation = await ctx.db.get(args.reservationId as Id<"reservations">)
  if (!reservation) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  const unit = await ctx.db.get(reservation.inventoryUnitId)
  if (!unit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  assertOwnership(unit, caller)

  // Idempotent: already confirmed is a no-op
  if (reservation.status === RESERVATION_STATUS.Confirmed) return

  if (reservation.status !== RESERVATION_STATUS.PendingAcceptance) {
    throw new ConvexError({ code: ErrorCode.INVALID_STATUS })
  }

  await ctx.db.patch(args.reservationId as Id<"reservations">, {
    status: RESERVATION_STATUS.Confirmed,
    confirmedAt: Date.now(),
  })

  await logBookingChange(ctx, {
    bookingId: reservation.bookingId as string,
    action: 'reservation_accepted',
    actorSlug: caller.slug,
    actorType: 'resource',
  })

  await tryAutoAdvance(ctx, reservation.bookingId)
}

export const acceptReservation = mutation({
  args: { reservationId: v.id('reservations') },
  handler: _acceptHandler,
})

// ─── acceptBookingReservations ────────────────────────────────────────────────

/**
 * Accepts ALL PendingAcceptance reservations for a given booking+inventoryUnit
 * in one mutation. Used by the Open Requests widget so multi-day bookings
 * are confirmed with a single click.
 */
export async function _acceptBookingHandler(
  ctx: MutationCtx,
  args: { bookingId: string; inventoryUnitId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const unit = await ctx.db.get(args.inventoryUnitId as Id<"inventoryUnits">)
  if (!unit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  assertOwnership(unit, caller)

  const unitReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId_inventoryUnitId', (q) =>
      q.eq('bookingId', args.bookingId as Id<"bookings">).eq('inventoryUnitId', args.inventoryUnitId as Id<"inventoryUnits">),
    )
    .collect()

  const pending = unitReservations.filter(
    (r) => r.status === RESERVATION_STATUS.PendingAcceptance,
  )

  if (pending.length === 0) return // idempotent

  for (const res of pending) {
    await ctx.db.patch(res._id, { status: RESERVATION_STATUS.Confirmed, confirmedAt: Date.now() })
  }

  await logBookingChange(ctx, {
    bookingId: args.bookingId,
    action: 'reservation_accepted',
    actorSlug: caller.slug,
    actorType: 'resource',
    note: `Bulk accepted ${pending.length} reservation(s) for unit ${unit.displayName}`,
  })

  await tryAutoAdvance(ctx, args.bookingId)
}

export const acceptBookingReservations = mutation({
  args: {
    bookingId: v.id('bookings'),
    inventoryUnitId: v.id('inventoryUnits'),
  },
  handler: _acceptBookingHandler,
})

// ─── declineReservation ───────────────────────────────────────────────────────

/**
 * Core implementation — exported for unit testing.
 *
 * Vacates ALL active (PendingAcceptance | Confirmed) reservations for the given
 * inventoryUnit on the booking, restoring AvailabilitySnapshot counts atomically.
 * Clears the denormalized booking field, notifies the booking owner, and checks
 * for same-location alternatives (notifying owner with no_backup_available if none).
 */
export async function _declineHandler(
  ctx: MutationCtx,
  args: { bookingId: string; inventoryUnitId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const unit = await ctx.db.get(args.inventoryUnitId as Id<"inventoryUnits">)
  if (!unit) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  assertOwnership(unit, caller)

  const booking = await ctx.db.get(args.bookingId as Id<"bookings">)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  // Guard: cannot decline on a finalized booking
  if (booking.status === BOOKING_STATUS.Completed || booking.status === BOOKING_STATUS.Cancelled) {
    throw new ConvexError({ code: ErrorCode.INVALID_STATUS })
  }

  // Collect all active reservations for this unit on this booking
  const unitReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId_inventoryUnitId', (q) =>
      q.eq('bookingId', args.bookingId as Id<"bookings">).eq('inventoryUnitId', args.inventoryUnitId as Id<"inventoryUnits">),
    )
    .collect()

  const activeForUnit = unitReservations.filter(isActiveReservation)

  const now = Date.now()

  // Vacate each reservation and restore its snapshot atomically (Invariant 3)
  for (const reservation of activeForUnit) {
    await ctx.db.patch(reservation._id, {
      status: RESERVATION_STATUS.Vacated,
      vacatedAt: now,
      vacatedBy: VACATED_REASON.StakeholderDeclined,
    })

    const session = await ctx.db.get(reservation.bookingSessionId)
    if (!session) {
      throw new ConvexError({
        code: ErrorCode.ORPHANED_RESERVATION,
        reason: `Reservation ${reservation._id} references missing session ${reservation.bookingSessionId}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    // Snapshot lookup uses windowStart to match the exact time window
    const snapshot = await getAvailabilitySnapshot(ctx, args.inventoryUnitId as Id<"inventoryUnits">, session.date, session.startTime)

    if (!snapshot) {
      throw new ConvexError({
        code: ErrorCode.MISSING_SNAPSHOT,
        reason: `No availability snapshot found for unit ${args.inventoryUnitId} on ${session.date} at ${session.startTime}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    await restoreSnapshotUnits(ctx, snapshot._id, reservation.unitsRequested)
  }

  // Delete from bookingResources junction table
  await deleteResourceByType(ctx, args.bookingId, unit.resourceType as string)

  // Cascade booking status if needed
  const bookingPatch: Record<string, unknown> = {}
  if (booking.status === BOOKING_STATUS.Upcoming) {
    bookingPatch.status = BOOKING_STATUS.Draft
    bookingPatch.bookingFormComplete = false
    bookingPatch.expiresAt = now + booking.holdTTL
  }
  if (Object.keys(bookingPatch).length > 0) {
    await ctx.db.patch(args.bookingId as Id<"bookings">, bookingPatch)
  }

  await logBookingChange(ctx, {
    bookingId: args.bookingId,
    action: 'reservation_declined',
    actorSlug: caller.slug,
    actorType: 'resource',
  })

  // Notify the booking owner of the decline
  await ctx.db.insert('notifications', {
    userId: booking.ownerId,
    type: NOTIFICATION_TYPE.HoldDeclined,
    bookingId: args.bookingId as Id<"bookings">,
    message: `${unit.displayName} has declined the reservation.`,
    createdAt: now,
  })

  // Check for same-location alternatives of the same resource type
  const declinedCity = await getOwnerCity(ctx, unit.ownerId, unit.resourceType as ResourceType)
  const bookingDates = getDatesInRange(booking.startDate, booking.endDate)

  const allSameTypeUnits = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_resourceType', (q) => q.eq('resourceType', unit.resourceType))
    .collect()

  // Exclude the declined unit and bound the search
  const candidates = allSameTypeUnits
    .filter((u) => u._id !== args.inventoryUnitId)
    .slice(0, MAX_CANDIDATES)

  // Batch-fetch all snapshots for booking dates in O(dates) queries instead of O(candidates*dates)
  const snapshotsByUnitAndDate = new Map<string, boolean>()
  const dateSnapshots = await Promise.all(
    bookingDates.map((date) =>
      ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_date', (q) => q.eq('date', date))
        .collect(),
    ),
  )
  for (let i = 0; i < bookingDates.length; i++) {
    for (const snap of dateSnapshots[i]) {
      const key = `${snap.inventoryUnitId}:${bookingDates[i]}`
      // Mark as available if ANY window on that date has capacity
      if (snap.availableUnits > 0) {
        snapshotsByUnitAndDate.set(key, true)
      } else if (!snapshotsByUnitAndDate.has(key)) {
        snapshotsByUnitAndDate.set(key, false)
      }
    }
  }

  // Batch-fetch cities for all candidates in parallel (eliminates N+1)
  const candidateSlugs = candidates.map((c) => c.ownerId)
  const cityMap = await batchGetOwnerCities(ctx, candidateSlugs, unit.resourceType as ResourceType)

  let hasAlternative = false

  for (const candidate of candidates) {
    if (hasAlternative) break

    const candidateCity = cityMap.get(candidate.ownerId) ?? null
    // Only skip when both cities are known and differ
    if (declinedCity && candidateCity && candidateCity !== declinedCity) continue

    // Candidate must have available capacity on every booking date (from pre-fetched map)
    let availableOnAll = true
    for (const date of bookingDates) {
      const key = `${candidate._id}:${date}`
      if (!snapshotsByUnitAndDate.get(key)) {
        availableOnAll = false
        break
      }
    }

    if (availableOnAll) hasAlternative = true
  }

  if (!hasAlternative) {
    await ctx.db.insert('notifications', {
      userId: booking.ownerId,
      type: NOTIFICATION_TYPE.NoBackupAvailable,
      bookingId: args.bookingId as Id<"bookings">,
      message: `No available ${unit.resourceType} found in this area for the booking dates.`,
      createdAt: now,
    })
  }
}

export const declineReservation = mutation({
  args: {
    bookingId: v.id('bookings'),
    inventoryUnitId: v.id('inventoryUnits'),
  },
  handler: _declineHandler,
})

// ─── declineByBookingForCaller ────────────────────────────────────────────────

/**
 * Resolves the caller's inventory unit(s) with active reservations on the
 * booking, then declines all of them. Avoids threading inventoryUnitId
 * through the client calendar data model.
 */
export const declineByBookingForCaller = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const { user: caller } = await requireAuth(ctx)

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', caller.slug))
      .collect()

    if (units.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No inventory units found for caller.' })
    }

    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()

    const callerUnitIds = new Set(units.map((u) => u._id))
    const activeForCaller = reservations.filter(
      (r) =>
        callerUnitIds.has(r.inventoryUnitId) && isActiveReservation(r),
    )

    if (activeForCaller.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No active reservations found for this booking.' })
    }

    // Decline via each distinct inventory unit
    const declinedUnits = new Set<string>()
    for (const res of activeForCaller) {
      if (declinedUnits.has(res.inventoryUnitId)) continue
      declinedUnits.add(res.inventoryUnitId)
      await _declineHandler(ctx, {
        bookingId: args.bookingId as string,
        inventoryUnitId: res.inventoryUnitId as string,
      })
    }
  },
})

// ─── acceptByBookingForCaller ─────────────────────────────────────────────────

/**
 * Resolves the caller's inventory unit(s) with PendingAcceptance reservations
 * on the booking, then confirms all of them. Mirrors declineByBookingForCaller.
 */
export const acceptByBookingForCaller = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const { user: caller } = await requireAuth(ctx)

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', caller.slug))
      .collect()

    if (units.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No inventory units found for caller.' })
    }

    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId_status', (q) =>
        q.eq('bookingId', args.bookingId).eq('status', RESERVATION_STATUS.PendingAcceptance),
      )
      .collect()

    const callerUnitIds = new Set(units.map((u) => u._id))
    const pendingForCaller = reservations.filter((r) =>
      callerUnitIds.has(r.inventoryUnitId),
    )

    if (pendingForCaller.length === 0) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'No pending reservations found for this booking.' })
    }

    for (const res of pendingForCaller) {
      await _acceptHandler(ctx, { reservationId: res._id as string })
    }
  },
})

// ─── NoShow ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the session's start time has passed (in its timezone).
 */
function hasSessionStarted(session: { date: string; startTime: string; timezone?: string }): boolean {
  const tz = session.timezone ?? 'Asia/Bangkok'
  const nowLocal = new Date().toLocaleString('en-US', { timeZone: tz })
  const now = new Date(nowLocal)

  const sessionStart = new Date(`${session.date}T${session.startTime}:00`)
  return now >= sessionStart
}

export async function _markNoShowHandler(
  ctx: MutationCtx,
  args: { reservationId: Id<'reservations'> },
): Promise<void> {
  const { user } = await requireAuth(ctx)

  const reservation = await ctx.db.get(args.reservationId)
  if (!reservation) {
    throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'Reservation not found.' })
  }

  // Ownership check: only booking owner can mark NoShow
  const booking = await ctx.db.get(reservation.bookingId)
  if (!booking || booking.ownerId !== user.slug) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Only the booking owner can mark NoShow.' })
  }

  // State guard
  const status = reservation.status as ReservationStatus
  if (!canReservationTransition(status, 'mark_noshow')) {
    throw new ConvexError({
      code: ErrorCode.INVALID_TRANSITION,
      reason: `Cannot mark NoShow from ${reservation.status}.`,
    })
  }

  // Time gate: session must have started
  const session = await ctx.db.get(reservation.bookingSessionId)
  if (!session || !hasSessionStarted(session)) {
    throw new ConvexError({
      code: ErrorCode.TOO_EARLY,
      reason: 'Cannot mark NoShow before session start time.',
    })
  }

  // Mark NoShow — do NOT restore snapshot (capacity stays consumed)
  await ctx.db.patch(args.reservationId, {
    status: RESERVATION_STATUS.NoShow,
    noShowAt: Date.now(),
  })

  await logBookingChange(ctx, {
    bookingId: reservation.bookingId as string,
    action: 'noshow_marked',
    actorSlug: user.slug,
    actorType: 'operator',
  })

  // Notify resource stakeholder
  const unit = await ctx.db.get(reservation.inventoryUnitId)
  if (unit) {
    await notify(ctx, {
      userId: unit.ownerId,
      type: NOTIFICATION_TYPE.NoshowMarked,
      bookingId: reservation.bookingId as string,
      message: `A customer was marked as NoShow for your ${session.date} session.`,
    })
  }
}

export async function _revertNoShowHandler(
  ctx: MutationCtx,
  args: { reservationId: Id<'reservations'> },
): Promise<void> {
  const { user } = await requireAuth(ctx)

  const reservation = await ctx.db.get(args.reservationId)
  if (!reservation) {
    throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'Reservation not found.' })
  }

  // Ownership check
  const booking = await ctx.db.get(reservation.bookingId)
  if (!booking || booking.ownerId !== user.slug) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Only the booking owner can revert NoShow.' })
  }

  // State guard
  const status = reservation.status as ReservationStatus
  if (!canReservationTransition(status, 'revert_noshow')) {
    throw new ConvexError({
      code: ErrorCode.INVALID_TRANSITION,
      reason: `Cannot revert from ${reservation.status}.`,
    })
  }

  // 24h window check
  if (!reservation.noShowAt || Date.now() - reservation.noShowAt > NOSHOW_REVERT_WINDOW_MS) {
    throw new ConvexError({
      code: ErrorCode.REVERT_WINDOW_EXPIRED,
      reason: 'NoShow can only be reverted within 24 hours.',
    })
  }

  // Revert to Confirmed
  await ctx.db.patch(args.reservationId, {
    status: RESERVATION_STATUS.Confirmed,
    noShowAt: undefined,
  })

  await logBookingChange(ctx, {
    bookingId: reservation.bookingId as string,
    action: 'noshow_reverted',
    actorSlug: user.slug,
    actorType: 'operator',
  })

  // Notify resource stakeholder
  const session = await ctx.db.get(reservation.bookingSessionId)
  const unit = await ctx.db.get(reservation.inventoryUnitId)
  if (unit && session) {
    await notify(ctx, {
      userId: unit.ownerId,
      type: NOTIFICATION_TYPE.NoshowReverted,
      bookingId: reservation.bookingId as string,
      message: `NoShow was reverted for your ${session.date} session. Customer is back to Confirmed.`,
    })
  }
}

export const markNoShow = mutation({
  args: { reservationId: v.id('reservations') },
  handler: async (ctx, args) => {
    await _markNoShowHandler(ctx, args)
  },
})

export const revertNoShow = mutation({
  args: { reservationId: v.id('reservations') },
  handler: async (ctx, args) => {
    await _revertNoShowHandler(ctx, args)
  },
})
