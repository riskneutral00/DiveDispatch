/**
 * Inventory release helpers for booking mutations. Handles restoring
 * availability snapshots when reservations are vacated.
 * Extracted from _shared.ts (L8-24).
 *
 * DD-278: purgeExpiredDrafts refactored to internalAction + per-booking
 * internalMutation for true per-booking atomicity. restoreSnapshotUnits
 * hardened with double-write guard and underflow throw.
 */

import { ConvexError, v } from 'convex/values'
import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { internal } from '../_generated/api'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { VacatedReason } from '../shared/statuses'
import { BOOKING_STATUS, RESERVATION_STATUS, VACATED_REASON } from '../shared/statuses'
import { ErrorCode } from '../lib/errorCodes'
import { assertValidTime } from '../lib/validators'
import { logBookingChange } from '../bookingAuditLog'
import { batchPatch } from '../lib/batch'
import { releaseBagsForBooking } from '../equipmentBags'

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

/**
 * Restore availability snapshot when a reservation is released.
 * Re-reads snapshot from DB to avoid TOCTOU stale-parameter bugs (DD-017).
 *
 * DD-278 guards:
 * - Optional `seenSnapshotIds` set detects double-write on the same snapshot
 *   within a single mutation call. Callers processing multiple snapshots in
 *   a loop should create a Set and pass it to each call.
 * - Throws SNAPSHOT_UNDERFLOW instead of silently clamping when
 *   unitsRequested exceeds reservedUnits, exposing data inconsistencies.
 */
export async function restoreSnapshotUnits(
  ctx: MutationCtx,
  snapshotId: Id<"availabilitySnapshots">,
  unitsRequested: number,
  seenSnapshotIds?: Set<string>,
) {
  if (seenSnapshotIds) {
    if (seenSnapshotIds.has(snapshotId)) {
      throw new ConvexError({
        code: ErrorCode.SNAPSHOT_DOUBLE_WRITE,
        reason: `AvailabilitySnapshot ${snapshotId} has already been restored in this mutation. This indicates a bug in the accumulation logic — each snapshot must be patched at most once per mutation.`,
      })
    }
    seenSnapshotIds.add(snapshotId)
  }

  const fresh = await ctx.db.get(snapshotId)
  if (!fresh) {
    throw new ConvexError({
      code: ErrorCode.MISSING_SNAPSHOT_ON_RELEASE,
      reason: `AvailabilitySnapshot ${snapshotId} disappeared between lookup and restore. Aborting to prevent capacity leak.`,
    })
  }

  if (unitsRequested > fresh.reservedUnits) {
    throw new ConvexError({
      code: ErrorCode.SNAPSHOT_UNDERFLOW,
      reason: `Cannot release ${unitsRequested} units from snapshot ${snapshotId} — only ${fresh.reservedUnits} are reserved. This indicates a data inconsistency.`,
    })
  }

  await ctx.db.patch(snapshotId, {
    availableUnits: fresh.availableUnits + unitsRequested,
    reservedUnits: fresh.reservedUnits - unitsRequested,
  })
}

/** Upper bound on reservations fetched per status query. Prevents unbounded memory use. */
export const MAX_RESERVATIONS_PER_BOOKING = 500

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
  inventoryUnitId?: Id<'inventoryUnits'>,
): Promise<void> {
  const [pending, confirmed] = await Promise.all([
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId_status', (q) =>
        q.eq('bookingId', bookingId as Id<'bookings'>).eq('status', RESERVATION_STATUS.PendingAcceptance),
      )
      .take(MAX_RESERVATIONS_PER_BOOKING + 1),
    ctx.db
      .query('reservations')
      .withIndex('by_bookingId_status', (q) =>
        q.eq('bookingId', bookingId as Id<'bookings'>).eq('status', RESERVATION_STATUS.Confirmed),
      )
      .take(MAX_RESERVATIONS_PER_BOOKING + 1),
  ])

  if (pending.length > MAX_RESERVATIONS_PER_BOOKING) {
    throw new ConvexError({
      code: ErrorCode.INVARIANT_VIOLATION,
      reason: `Booking ${bookingId} has more than ${MAX_RESERVATIONS_PER_BOOKING} PendingAcceptance reservations — cannot safely release. Manual intervention required.`,
    })
  }

  if (confirmed.length > MAX_RESERVATIONS_PER_BOOKING) {
    throw new ConvexError({
      code: ErrorCode.INVARIANT_VIOLATION,
      reason: `Booking ${bookingId} has more than ${MAX_RESERVATIONS_PER_BOOKING} Confirmed reservations — cannot safely release. Manual intervention required.`,
    })
  }

  // When inventoryUnitId is provided, only release that unit's reservations (decline path).
  // When omitted, release all active reservations (cancellation/cascade path).
  const all = [...pending, ...confirmed]
  const active = inventoryUnitId
    ? all.filter((r) => r.inventoryUnitId === inventoryUnitId)
    : all

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
  const vacatedAt = Date.now()
  await batchPatch(ctx, active.map((res) => [res._id, {
    status: RESERVATION_STATUS.Vacated,
    vacatedAt,
    vacatedBy: reason,
  }] as const))

  const seenSnapshotIds = new Set<string>()
  for (const [key, units] of unitsToRestore) {
    const snapshotId = snapshotIdMap.get(key)!
    await restoreSnapshotUnits(ctx, snapshotId, units, seenSnapshotIds) // batch-exempt: seenSnapshotIds guard requires sequential execution
  }

  // Release equipment bags when releasing ALL reservations (cancel/expire/edit).
  // Skip on targeted decline (inventoryUnitId set) — bags are booking-level, not unit-level.
  if (!inventoryUnitId) {
    await releaseBagsForBooking(ctx, bookingId)
  }
}

// ─── purgeExpiredDrafts (cron) ──────────────────────────────────────────────

const BATCH_SIZE = 25

/**
 * Query: find up to BATCH_SIZE expired Draft bookings.
 * Used by purgeExpiredDrafts action to separate read from write.
 */
export const findExpiredDrafts = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<{ bookingId: Id<'bookings'> }>> => {
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

    return staleDrafts.map((b) => ({ bookingId: b._id }))
  },
})

/**
 * Mutation: purge a single expired Draft booking.
 * Each call is its own atomic unit — a failure here does not affect other bookings.
 * Called by the purgeExpiredDrafts action coordinator.
 */
export const purgeOneDraft = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }): Promise<void> => {
    const booking = await ctx.db.get(bookingId)
    if (!booking || booking.status !== BOOKING_STATUS.Draft) return

    await releaseBookingReservations(ctx, booking._id, VACATED_REASON.HoldExpired)
    await ctx.db.patch(booking._id, { status: BOOKING_STATUS.Cancelled })
    await logBookingChange(ctx, {
      bookingId: booking._id,
      action: 'expired_draft_purged',
      actorSlug: 'system',
      actorType: 'system',
    })
  },
})

import { extractErrorCode, ISOLATABLE_ERRORS } from '../lib/errorClassification'

/**
 * Cron: purge Draft bookings whose holdTTL has lapsed.
 * Runs every 6 hours. Vacates reservations, restores availability snapshots,
 * cancels the booking, and logs an audit entry.
 *
 * DD-278: Refactored from internalMutation to internalAction. Each booking
 * is processed in an isolated ctx.runMutation call so a failure on booking N
 * does not roll back writes for bookings 1…N-1.
 *
 * Batch limit: 25 per run to stay within Convex limits.
 */
export const purgeExpiredDrafts = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    purged: number
    skipped: number
    errors: Array<{ bookingId: string; errorCode: string }>
  }> => {
    const expiredDrafts = await ctx.runQuery(
      internal.bookings.inventoryRelease.findExpiredDrafts,
      {},
    )

    let purged = 0
    const errors: Array<{ bookingId: string; errorCode: string }> = []

    for (const { bookingId } of expiredDrafts) {
      try {
        await ctx.runMutation(
          internal.bookings.inventoryRelease.purgeOneDraft,
          { bookingId },
        )
        purged++
      } catch (err) {
        const errorCode = extractErrorCode(err)
        // Re-throw unrecognized errors to surface unexpected failures.
        // Only known inventory-corruption errors are safe to isolate per-booking.
        if (!ISOLATABLE_ERRORS.has(errorCode)) {
          throw err
        }
        console.error(`purgeExpiredDrafts: failed to purge booking`, {
          bookingId,
          errorCode,
        })
        errors.push({ bookingId, errorCode })
      }
    }

    return { purged, skipped: errors.length, errors }
  },
})
