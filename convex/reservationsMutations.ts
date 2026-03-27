import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireAuth } from './lib/auth'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { tryAutoAdvance, restoreSnapshotUnits, canReservationTransition } from './bookings/_shared'
import { deleteResourceByType } from './bookingResources'

import { type ResourceOwnerType as ResourceType } from './shared/resourceOwnerTypes'
import { getDatesInRange } from './shared/dateRange'
import { notify } from './notifications'
import { logBookingChange } from './bookingAuditLog'
import { ErrorCode } from './lib/errorCodes'

// Re-export for test backwards compatibility
export { getDatesInRange as getDateRange } from './shared/dateRange'


/**
 * Looks up the placeName of an inventoryUnit owner via their role-specific profile table.
 * Returns null if the owner or profile cannot be found.
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

  let profile: { placeName?: string } | null = null

  if (ownerType === 'Instructor') {
    profile = await ctx.db
      .query('instructors')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Boat') {
    profile = await ctx.db
      .query('boats')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Equipment') {
    profile = await ctx.db
      .query('equipment')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Pool') {
    profile = await ctx.db
      .query('venues')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Compressor') {
    profile = await ctx.db
      .query('compressors')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  }

  return profile?.placeName ?? null
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

  if (unit.ownerId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  // Idempotent: already confirmed is a no-op
  if (reservation.status === 'Confirmed') return

  if (reservation.status !== 'PendingAcceptance') {
    throw new ConvexError({ code: ErrorCode.INVALID_STATUS })
  }

  await ctx.db.patch(args.reservationId as Id<"reservations">, {
    status: 'Confirmed',
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
  if (unit.ownerId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  const unitReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId_inventoryUnitId', (q) =>
      q.eq('bookingId', args.bookingId as Id<"bookings">).eq('inventoryUnitId', args.inventoryUnitId as Id<"inventoryUnits">),
    )
    .collect()

  const pending = unitReservations.filter(
    (r) => r.status === 'PendingAcceptance',
  )

  if (pending.length === 0) return // idempotent

  for (const res of pending) {
    await ctx.db.patch(res._id, { status: 'Confirmed', confirmedAt: Date.now() })
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
  if (unit.ownerId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  const booking = await ctx.db.get(args.bookingId as Id<"bookings">)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  // Guard: cannot decline on a finalized booking
  if (booking.status === 'Completed' || booking.status === 'Cancelled') {
    throw new ConvexError({ code: ErrorCode.INVALID_STATUS })
  }

  // Collect all active reservations for this unit on this booking
  const unitReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId_inventoryUnitId', (q) =>
      q.eq('bookingId', args.bookingId as Id<"bookings">).eq('inventoryUnitId', args.inventoryUnitId as Id<"inventoryUnits">),
    )
    .collect()

  const activeForUnit = unitReservations.filter(
    (r) => r.status === 'PendingAcceptance' || r.status === 'Confirmed',
  )

  const now = Date.now()

  // Vacate each reservation and restore its snapshot atomically (Invariant 3)
  for (const reservation of activeForUnit) {
    await ctx.db.patch(reservation._id, {
      status: 'Vacated',
      vacatedAt: now,
      vacatedBy: 'stakeholder_declined',
    })

    const session = await ctx.db.get(reservation.bookingSessionId)
    if (!session) {
      throw new ConvexError({
        code: ErrorCode.ORPHANED_RESERVATION,
        reason: `Reservation ${reservation._id} references missing session ${reservation.bookingSessionId}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    // Snapshot lookup uses windowStart to match the exact time window
    const snapshot = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
        q
          .eq('inventoryUnitId', args.inventoryUnitId as Id<"inventoryUnits">)
          .eq('date', session.date)
          .eq('windowStart', session.startTime),
      )
      .unique()

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
  if (booking.status === 'Upcoming') {
    bookingPatch.status = 'Draft'
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
    type: 'hold_declined',
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

  const candidates = allSameTypeUnits.filter((u) => u._id !== args.inventoryUnitId)

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

  let hasAlternative = false

  for (const candidate of candidates) {
    if (hasAlternative) break

    const candidateCity = await getOwnerCity(
      ctx,
      candidate.ownerId,
      candidate.ownerType as ResourceType,
    )
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
      type: 'no_backup_available',
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
        callerUnitIds.has(r.inventoryUnitId) &&
        (r.status === 'PendingAcceptance' || r.status === 'Confirmed'),
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
        q.eq('bookingId', args.bookingId).eq('status', 'PendingAcceptance'),
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

const NOSHOW_REVERT_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

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
  const status = reservation.status as 'PendingAcceptance' | 'Confirmed' | 'Vacated' | 'NoShow'
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
    status: 'NoShow',
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
      type: 'noshow_marked',
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
  const status = reservation.status as 'PendingAcceptance' | 'Confirmed' | 'Vacated' | 'NoShow'
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
    status: 'Confirmed',
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
      type: 'noshow_reverted',
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
