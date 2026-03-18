import { ConvexError } from 'convex/values'
import { type AnyCtx } from './lib/auth'

// ─── Pure helpers (exported for unit testing + cross-module use) ──────────────

/**
 * Assigns the lowest-bag-numbered available bags to the booking.
 * Picks exactly `diverCount` bags — one per diver.
 *
 * Throws `ConvexError({ code: 'CONFLICT', reason: 'Insufficient equipment bags' })`
 * if fewer than `diverCount` bags are available.
 *
 * Must be called from within a mutation so the patch writes are part of the
 * same atomic Convex transaction as the reservation and snapshot writes.
 * (Invariant #3: "All AvailabilitySnapshot updates occur in the same Convex
 * mutation as the Reservation write.")
 */
export async function assignBagsForBooking(
  ctx: AnyCtx,
  bookingId: string,
  equipmentManagerId: string,
  diverCount: number,
): Promise<void> {
  const bags = await ctx.db
    .query('equipmentBags')
    .withIndex('by_equipmentManagerId', (q: AnyCtx) =>
      q.eq('equipmentManagerId', equipmentManagerId),
    )
    .collect()

  const available = (bags as AnyCtx[])
    .filter((b) => b.status === 'Returned')
    .sort((a, b) => String(a.bagNumber).localeCompare(String(b.bagNumber)))

  if (available.length < diverCount) {
    throw new ConvexError({ code: 'CONFLICT', reason: 'Insufficient equipment bags' })
  }

  const now = Date.now()
  const toAssign = available.slice(0, diverCount)

  for (const bag of toAssign) {
    await ctx.db.patch(bag._id, {
      status: 'Assigned',
      bookingId,
      assignedAt: now,
    })
  }
}

/**
 * Releases all bags currently assigned to the given booking.
 * Sets status back to 'Returned' so they become available for future bookings.
 *
 * Called from `releaseBookingReservations` on booking cancellation, stakeholder
 * decline, hold expiry, or operator edit. Only releases bags in 'Assigned'
 * status — 'InUse' bags (physically picked up) are not touched here to avoid
 * data loss in mid-use scenarios; those are handled by the EM manually.
 */
export async function releaseBagsForBooking(
  ctx: AnyCtx,
  bookingId: string,
): Promise<void> {
  const bags = await ctx.db
    .query('equipmentBags')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', bookingId))
    .collect()

  const assigned = (bags as AnyCtx[]).filter((b) => b.status === 'Assigned')

  for (const bag of assigned) {
    await ctx.db.patch(bag._id, {
      status: 'Returned',
      returnedAt: Date.now(),
    })
  }
}
