/**
 * Inventory release helpers for booking mutations. Handles restoring
 * availability snapshots when reservations are vacated.
 * Extracted from _shared.ts (L8-24).
 */

import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { VacatedReason } from './state-machine'

/** Restore availability snapshot when a reservation is released. */
export async function restoreSnapshotUnits(
  ctx: MutationCtx,
  snapshotId: Id<"availabilitySnapshots">,
  currentAvailable: number,
  currentReserved: number,
  unitsRequested: number,
) {
  await ctx.db.patch(snapshotId, {
    availableUnits: currentAvailable + unitsRequested,
    reservedUnits: Math.max(0, currentReserved - unitsRequested),
  })
}

/**
 * Vacates all active (PendingAcceptance | Confirmed) reservations for a booking
 * and restores their corresponding AvailabilitySnapshot counts atomically.
 * Used by: edit mode re-submission, cancellation, TTL expiry.
 */
export async function releaseBookingReservations(
  ctx: MutationCtx,
  bookingId: string,
  reason: VacatedReason,
): Promise<void> {
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()

  const active = reservations.filter(
    (r) => r.status === 'PendingAcceptance' || r.status === 'Confirmed',
  )

  for (const res of active) {
    await ctx.db.patch(res._id, {
      status: 'Vacated',
      vacatedAt: Date.now(),
      vacatedBy: reason,
    })

    // Restore snapshot units using the linked booking session for window coordinates
    const session = await ctx.db.get(res.bookingSessionId)
    if (!session) {
      throw new ConvexError({
        code: 'ORPHANED_RESERVATION',
        reason: `Reservation ${res._id} references missing session ${res.bookingSessionId}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    const snapshot = await ctx.db
      .query('availabilitySnapshots')
      .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
        q
          .eq('inventoryUnitId', res.inventoryUnitId)
          .eq('date', session.date)
          .eq('windowStart', session.startTime),
      )
      .unique()

    if (!snapshot) {
      throw new ConvexError({
        code: 'MISSING_SNAPSHOT',
        reason: `No availability snapshot found for unit ${res.inventoryUnitId} on ${session.date} at ${session.startTime}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    await restoreSnapshotUnits(ctx, snapshot._id, snapshot.availableUnits, snapshot.reservedUnits, res.unitsRequested)
  }
}
