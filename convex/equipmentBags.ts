import { ConvexError } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { ErrorCode } from './lib/errorCodes'
import { BAG_STATUS } from './shared/statuses'
import { batchPatch } from './lib/batch'

// ─── Pure helpers (exported for unit testing + cross-module use) ──────────────

/**
 * Assigns the lowest-bag-numbered available bags to the booking.
 * Picks exactly `diverCount` bags — one per diver.
 *
 * Throws `ConvexError({ code: ErrorCode.CONFLICT, reason: 'Insufficient equipment bags' })`
 * if fewer than `diverCount` bags are available.
 *
 * Must be called from within a mutation so the patch writes are part of the
 * same atomic Convex transaction as the reservation and snapshot writes.
 * (Invariant #3: "All AvailabilitySnapshot updates occur in the same Convex
 * mutation as the Reservation write.")
 */
export async function assignBagsForBooking(
  ctx: MutationCtx,
  bookingId: string,
  equipmentManagerId: string,
  diverCount: number,
): Promise<void> {
  const bags = await ctx.db
    .query('equipmentBags')
    .withIndex('by_equipmentManagerId', (q) =>
      q.eq('equipmentManagerId', equipmentManagerId),
    )
    .collect() // bounded: per-booking bags

  const available = bags
    .filter((b) => b.status === BAG_STATUS.Returned)
    .sort((a, b) => String(a.bagNumber).localeCompare(String(b.bagNumber)))

  if (available.length < diverCount) {
    throw new ConvexError({ code: ErrorCode.CONFLICT, reason: 'Insufficient equipment bags' })
  }

  const now = Date.now()
  const toAssign = available.slice(0, diverCount)

  await batchPatch(ctx, toAssign.map((bag) => [bag._id, {
    status: BAG_STATUS.Assigned,
    bookingId: bookingId as Id<"bookings">,
    assignedAt: now,
  }] as const))
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
  ctx: MutationCtx,
  bookingId: string,
): Promise<void> {
  const bags = await ctx.db
    .query('equipmentBags')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<"bookings">))
    .collect() // bounded: per-booking bags

  const assigned = bags.filter((b) => b.status === BAG_STATUS.Assigned)
  const now = Date.now()

  await batchPatch(ctx, assigned.map((bag) => [bag._id, {
    status: BAG_STATUS.Returned,
    returnedAt: now,
  }] as const))
}
