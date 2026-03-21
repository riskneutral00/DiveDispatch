import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireAuth, type AnyCtx } from './lib/auth'
import { tryAutoAdvance } from './bookings/_shared'
import { deleteResourceByType } from './bookingResources'

type ResourceType =
  | 'Instructor'
  | 'Boat'
  | 'Equipment'
  | 'Pool'
  | 'Compressor'
  | 'Liveaboard'
  | 'DiveSite'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Generates an inclusive array of ISO date strings (YYYY-MM-DD) from startDate to endDate.
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}


/**
 * Looks up the city of an inventoryUnit owner via their role-specific profile table.
 * Returns null if the owner or profile cannot be found.
 */
async function getOwnerCity(
  ctx: AnyCtx,
  ownerSlug: string,
  ownerType: ResourceType,
): Promise<string | null> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', ownerSlug))
    .unique()
  if (!user) return null

  let profile: { city?: string } | null = null

  if (ownerType === 'Instructor') {
    profile = await ctx.db
      .query('instructors')
      .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Boat') {
    profile = await ctx.db
      .query('boats')
      .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Equipment') {
    profile = await ctx.db
      .query('equipment')
      .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Pool') {
    profile = await ctx.db
      .query('pools')
      .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', user._id))
      .unique()
  } else if (ownerType === 'Compressor') {
    profile = await ctx.db
      .query('compressors')
      .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', user._id))
      .unique()
  }

  return profile?.city ?? null
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
  ctx: AnyCtx,
  args: { reservationId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const reservation = await ctx.db.get(args.reservationId)
  if (!reservation) throw new ConvexError({ code: 'NOT_FOUND' })

  const unit = await ctx.db.get(reservation.inventoryUnitId)
  if (!unit) throw new ConvexError({ code: 'NOT_FOUND' })

  if (unit.ownerId !== caller.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  // Idempotent: already confirmed is a no-op
  if (reservation.status === 'Confirmed') return

  if (reservation.status !== 'PendingAcceptance') {
    throw new ConvexError({ code: 'INVALID_STATUS' })
  }

  await ctx.db.patch(args.reservationId, {
    status: 'Confirmed',
    confirmedAt: Date.now(),
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
  ctx: AnyCtx,
  args: { bookingId: string; inventoryUnitId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const unit = await ctx.db.get(args.inventoryUnitId)
  if (!unit) throw new ConvexError({ code: 'NOT_FOUND' })
  if (unit.ownerId !== caller.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
    .collect()

  const pending = reservations.filter(
    (r: AnyCtx) =>
      r.inventoryUnitId === args.inventoryUnitId && r.status === 'PendingAcceptance',
  )

  if (pending.length === 0) return // idempotent

  for (const res of pending) {
    await ctx.db.patch(res._id, { status: 'Confirmed', confirmedAt: Date.now() })
  }

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
  ctx: AnyCtx,
  args: { bookingId: string; inventoryUnitId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const unit = await ctx.db.get(args.inventoryUnitId)
  if (!unit) throw new ConvexError({ code: 'NOT_FOUND' })
  if (unit.ownerId !== caller.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  const booking = await ctx.db.get(args.bookingId)
  if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })

  // Guard: cannot decline on a finalized booking
  if (booking.status === 'Completed' || booking.status === 'Cancelled') {
    throw new ConvexError({ code: 'INVALID_STATUS' })
  }

  // Collect all active reservations for this unit on this booking
  const allBookingReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
    .collect()

  const activeForUnit = allBookingReservations.filter(
    (r: AnyCtx) =>
      r.inventoryUnitId === args.inventoryUnitId &&
      (r.status === 'PendingAcceptance' || r.status === 'Confirmed'),
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
    if (!session) continue

    // Snapshot lookup uses windowStart to match the exact time window
    const snapshot = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_inventoryUnitId_date_windowStart', (q: AnyCtx) =>
        q
          .eq('inventoryUnitId', args.inventoryUnitId)
          .eq('date', session.date)
          .eq('windowStart', session.startTime),
      )
      .unique()

    if (snapshot) {
      await ctx.db.patch(snapshot._id, {
        availableUnits: snapshot.availableUnits + reservation.unitsRequested,
        reservedUnits: Math.max(0, snapshot.reservedUnits - reservation.unitsRequested),
      })
    }
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
    await ctx.db.patch(args.bookingId, bookingPatch)
  }

  // Notify the booking owner of the decline
  await ctx.db.insert('notifications', {
    userId: booking.ownerId,
    type: 'hold_declined',
    bookingId: args.bookingId,
    message: `${unit.displayName} has declined the reservation.`,
    createdAt: now,
  })

  // Check for same-location alternatives of the same resource type
  const declinedCity = await getOwnerCity(ctx, unit.ownerId, unit.resourceType as ResourceType)
  const bookingDates = getDateRange(booking.startDate, booking.endDate)

  const allSameTypeUnits = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_resourceType', (q: AnyCtx) => q.eq('resourceType', unit.resourceType))
    .collect()

  const candidates = allSameTypeUnits.filter((u: AnyCtx) => u._id !== args.inventoryUnitId)

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

    // Candidate must have available capacity on every booking date
    let availableOnAll = true
    for (const date of bookingDates) {
      const snaps = await ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date', (q: AnyCtx) =>
          q.eq('inventoryUnitId', candidate._id).eq('date', date),
        )
        .collect()

      if (!snaps.some((s: AnyCtx) => s.availableUnits > 0)) {
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
      bookingId: args.bookingId,
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
      .withIndex('by_ownerId_ownerType', (q: AnyCtx) => q.eq('ownerId', caller.slug))
      .collect()

    if (units.length === 0) {
      throw new ConvexError({ code: 'NOT_FOUND', reason: 'No inventory units found for caller.' })
    }

    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect()

    const callerUnitIds = new Set(units.map((u: AnyCtx) => u._id))
    const activeForCaller = reservations.filter(
      (r: AnyCtx) =>
        callerUnitIds.has(r.inventoryUnitId) &&
        (r.status === 'PendingAcceptance' || r.status === 'Confirmed'),
    )

    if (activeForCaller.length === 0) {
      throw new ConvexError({ code: 'NOT_FOUND', reason: 'No active reservations found for this booking.' })
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
      .withIndex('by_ownerId_ownerType', (q: AnyCtx) => q.eq('ownerId', caller.slug))
      .collect()

    if (units.length === 0) {
      throw new ConvexError({ code: 'NOT_FOUND', reason: 'No inventory units found for caller.' })
    }

    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect()

    const callerUnitIds = new Set(units.map((u: AnyCtx) => u._id))
    const pendingForCaller = reservations.filter(
      (r: AnyCtx) =>
        callerUnitIds.has(r.inventoryUnitId) && r.status === 'PendingAcceptance',
    )

    if (pendingForCaller.length === 0) {
      throw new ConvexError({ code: 'NOT_FOUND', reason: 'No pending reservations found for this booking.' })
    }

    for (const res of pendingForCaller) {
      await _acceptHandler(ctx, { reservationId: res._id as string })
    }
  },
})
