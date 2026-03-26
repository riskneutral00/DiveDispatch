/**
 * Inventory release helpers for booking mutations. Handles restoring
 * availability snapshots when reservations are vacated.
 * Extracted from _shared.ts (L8-24).
 */

import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { VacatedReason } from './stateMachine'
import { ErrorCode } from '../lib/errorCodes'

/** Restore availability snapshot when a reservation is released.
 * Re-reads snapshot from DB to avoid TOCTOU stale-parameter bugs (DD-017). */
export async function restoreSnapshotUnits(
  ctx: MutationCtx,
  snapshotId: Id<"availabilitySnapshots">,
  unitsRequested: number,
) {
  const fresh = await ctx.db.get(snapshotId)
  if (!fresh) return
  await ctx.db.patch(snapshotId, {
    availableUnits: fresh.availableUnits + unitsRequested,
    reservedUnits: Math.max(0, fresh.reservedUnits - unitsRequested),
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
  const [pending, confirmed] = await Promise.all([
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId_status', (q) =>
        q.eq('bookingId', bookingId as Id<'bookings'>).eq('status', 'PendingAcceptance'),
      )
      .collect(),
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId_status', (q) =>
        q.eq('bookingId', bookingId as Id<'bookings'>).eq('status', 'Confirmed'),
      )
      .collect(),
  ])

  const active = [...pending, ...confirmed]

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
        code: ErrorCode.ORPHANED_RESERVATION,
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
        code: ErrorCode.MISSING_SNAPSHOT,
        reason: `No availability snapshot found for unit ${res.inventoryUnitId} on ${session.date} at ${session.startTime}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }

    await restoreSnapshotUnits(ctx, snapshot._id, res.unitsRequested)
  }
}
