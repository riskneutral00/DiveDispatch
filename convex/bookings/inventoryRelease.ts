/**
 * Inventory release helpers for booking mutations. Handles restoring
 * availability snapshots when reservations are vacated.
 * Extracted from _shared.ts (L8-24).
 */

import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { VacatedReason } from '../shared/statuses'
import { BOOKING_STATUS, RESERVATION_STATUS, VACATED_REASON } from '../shared/statuses'
import { ErrorCode } from '../lib/errorCodes'
import { assertValidTime } from '../lib/validators'
import { logBookingChange } from '../bookingAuditLog'

/**
 * Looks up a single AvailabilitySnapshot by inventoryUnitId + date + windowStart.
 * Returns the snapshot document or null if not found.
 * Replaces 3+ identical inline queries across the booking domain.
 */
export async function getAvailabilitySnapshot(
  ctx: QueryCtx | MutationCtx,
  inventoryUnitId: Id<'inventoryUnits'>,
  date: string,
  windowStart: string,
): Promise<Doc<'availabilitySnapshots'> | null> {
  assertValidTime(windowStart, 'windowStart')
  return ctx.db
    .query('availabilitySnapshots')
    .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
      q
        .eq('inventoryUnitId', inventoryUnitId)
        .eq('date', date)
        .eq('windowStart', windowStart),
    )
    .unique()
}

/** Restore availability snapshot when a reservation is released.
 * Re-reads snapshot from DB to avoid TOCTOU stale-parameter bugs (DD-017). */
export async function restoreSnapshotUnits(
  ctx: MutationCtx,
  snapshotId: Id<"availabilitySnapshots">,
  unitsRequested: number,
) {
  const fresh = await ctx.db.get(snapshotId)
  if (!fresh) {
    throw new ConvexError({
      code: ErrorCode.MISSING_SNAPSHOT_ON_RELEASE,
      reason: `AvailabilitySnapshot ${snapshotId} disappeared between lookup and restore. Aborting to prevent capacity leak.`,
    })
  }
  await ctx.db.patch(snapshotId, {
    availableUnits: fresh.availableUnits + unitsRequested,
    reservedUnits: Math.max(0, fresh.reservedUnits - unitsRequested),
  })
}

/** Upper bound on reservations fetched per status query. Prevents unbounded memory use. */
const MAX_RESERVATIONS_PER_BOOKING = 500

/**
 * Vacates all active (PendingAcceptance | Confirmed) reservations for a booking
 * and restores their corresponding AvailabilitySnapshot counts atomically.
 * Used by: edit mode re-submission, cancellation, TTL expiry.
 *
 * Sessions and snapshots are batch-fetched before the loop to avoid N+1 queries.
 * Units to restore are accumulated per snapshot so each snapshot is patched once.
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
        q.eq('bookingId', bookingId as Id<'bookings'>).eq('status', RESERVATION_STATUS.PendingAcceptance),
      )
      .take(MAX_RESERVATIONS_PER_BOOKING),
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId_status', (q) =>
        q.eq('bookingId', bookingId as Id<'bookings'>).eq('status', RESERVATION_STATUS.Confirmed),
      )
      .take(MAX_RESERVATIONS_PER_BOOKING),
  ])

  const active = [...pending, ...confirmed]

  if (active.length === 0) return

  // ── Batch-fetch sessions ──────────────────────────────────────────────────
  const uniqueSessionIds = [...new Set(active.map((r) => r.bookingSessionId))]
  const sessionDocs = await Promise.all(uniqueSessionIds.map((id) => ctx.db.get(id)))
  const sessionMap = new Map<string, Doc<'bookingSessions'>>()
  for (let i = 0; i < uniqueSessionIds.length; i++) {
    const doc = sessionDocs[i]
    if (!doc) {
      throw new ConvexError({
        code: ErrorCode.ORPHANED_RESERVATION,
        reason: `Reservation references missing session ${uniqueSessionIds[i]}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }
    sessionMap.set(uniqueSessionIds[i], doc)
  }

  // ── Batch-fetch snapshots ─────────────────────────────────────────────────
  // Build unique (inventoryUnitId, date, windowStart) lookup keys
  type SnapshotKey = { inventoryUnitId: Id<'inventoryUnits'>; date: string; windowStart: string }
  const snapshotKeyMap = new Map<string, SnapshotKey>()
  for (const res of active) {
    const session = sessionMap.get(res.bookingSessionId)!
    const key = `${res.inventoryUnitId}|${session.date}|${session.startTime}`
    if (!snapshotKeyMap.has(key)) {
      snapshotKeyMap.set(key, {
        inventoryUnitId: res.inventoryUnitId,
        date: session.date,
        windowStart: session.startTime,
      })
    }
  }

  const snapshotEntries = [...snapshotKeyMap.entries()]
  const snapshotDocs = await Promise.all(
    snapshotEntries.map(([, k]) => getAvailabilitySnapshot(ctx, k.inventoryUnitId, k.date, k.windowStart)),
  )
  const snapshotIdMap = new Map<string, Id<'availabilitySnapshots'>>()
  for (let i = 0; i < snapshotEntries.length; i++) {
    const doc = snapshotDocs[i]
    if (!doc) {
      const k = snapshotEntries[i][1]
      throw new ConvexError({
        code: ErrorCode.MISSING_SNAPSHOT,
        reason: `No availability snapshot found for unit ${k.inventoryUnitId} on ${k.date} at ${k.windowStart}. Inventory cannot be restored — aborting to prevent capacity leak.`,
      })
    }
    snapshotIdMap.set(snapshotEntries[i][0], doc._id)
  }

  // ── Accumulate units to restore per snapshot ──────────────────────────────
  const unitsToRestore = new Map<string, number>()
  for (const res of active) {
    const session = sessionMap.get(res.bookingSessionId)!
    const key = `${res.inventoryUnitId}|${session.date}|${session.startTime}`
    unitsToRestore.set(key, (unitsToRestore.get(key) ?? 0) + res.unitsRequested)
  }

  // ── Patch: vacate reservations + restore snapshots (writes only) ──────────
  for (const res of active) {
    await ctx.db.patch(res._id, {
      status: RESERVATION_STATUS.Vacated,
      vacatedAt: Date.now(),
      vacatedBy: reason,
    })
  }

  for (const [key, units] of unitsToRestore) {
    const snapshotId = snapshotIdMap.get(key)!
    await restoreSnapshotUnits(ctx, snapshotId, units)
  }
}

// ─── purgeExpiredDrafts (cron) ──────────────────────────────────────────────

const BATCH_SIZE = 25

/**
 * Cron: purge Draft bookings whose holdTTL has lapsed.
 * Runs every 6 hours. Vacates reservations, restores availability snapshots,
 * cancels the booking, and logs an audit entry.
 *
 * Batch limit: 25 per run to stay within Convex mutation limits.
 */
export const purgeExpiredDrafts = internalMutation({
  args: {},
  handler: async (ctx): Promise<{
    purged: number
    skipped: number
    errors: Array<{ bookingId: string; errorCode: string }>
  }> => {
    const now = Date.now()

    const staleDrafts = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q) => q.eq('status', BOOKING_STATUS.Draft))
      .filter((q) =>
        q.and(
          q.neq(q.field('expiresAt'), undefined),
          q.lt(q.field('expiresAt'), now),
        ),
      )
      .take(BATCH_SIZE)

    let purged = 0
    const errors: Array<{ bookingId: string; errorCode: string }> = []

    for (const booking of staleDrafts) {
      try {
        await releaseBookingReservations(ctx, booking._id, VACATED_REASON.HoldExpired)
        await ctx.db.patch(booking._id, { status: BOOKING_STATUS.Cancelled })
        await logBookingChange(ctx, {
          bookingId: booking._id,
          action: 'expired_draft_purged',
          actorSlug: 'system',
          actorType: 'system',
        })
        purged++
      } catch (err) {
        let errorCode = 'UNKNOWN'
        if (
          err instanceof ConvexError &&
          typeof err.data === 'object' &&
          err.data !== null &&
          'code' in err.data &&
          typeof (err.data as { code: unknown }).code === 'string'
        ) {
          errorCode = (err.data as { code: string }).code
        }
        console.error(`purgeExpiredDrafts: failed to purge booking`, {
          bookingId: booking._id,
          errorCode,
        })
        errors.push({ bookingId: booking._id, errorCode })
      }
    }

    return { purged, skipped: errors.length, errors }
  },
})
