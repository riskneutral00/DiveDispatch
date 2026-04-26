import { ConvexError, v } from 'convex/values'
import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { internal } from '../_generated/api'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { VacatedReason } from '../shared/statuses'
import { type BookingStatus, BOOKING_STATUS, RESERVATION_STATUS, VACATED_REASON } from '../shared/statuses'
import { canBookingTransition } from './stateMachine'
import { ErrorCode } from '../lib/errorCodes'
import { assertValidTime } from '../lib/validators'
import { logBookingChange } from '../lib/auditLog'
import { batchPatch } from '../lib/batch'
import { releaseBagsForBooking } from '../equipmentBags'
import { log } from '../lib/logger'

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

export const MAX_RESERVATIONS_PER_BOOKING = 500

async function releaseActiveReservations(
  ctx: MutationCtx,
  active: Doc<'reservations'>[],
  reason: VacatedReason,
): Promise<void> {
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

  const unitsToRestore = new Map<string, number>()
  for (const res of active) {
    const session = sessionMap.get(res.bookingSessionId)!
    const key = `${res.inventoryUnitId}|${session.date}|${session.startTime}`
    unitsToRestore.set(key, (unitsToRestore.get(key) ?? 0) + res.unitsRequested)
  }

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
}

async function fetchActiveReservations(
  ctx: MutationCtx,
  bookingId: string,
): Promise<Doc<'reservations'>[]> {
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

  return [...pending, ...confirmed]
}

export async function releaseBookingReservations(
  ctx: MutationCtx,
  bookingId: string,
  reason: VacatedReason,
): Promise<Doc<'reservations'>[]> {
  const all = await fetchActiveReservations(ctx, bookingId)

  if (all.length === 0) return []

  await releaseActiveReservations(ctx, all, reason)
  await releaseBagsForBooking(ctx, bookingId)

  return all
}

export async function releaseBookingReservationsByUnit(
  ctx: MutationCtx,
  bookingId: string,
  inventoryUnitId: Id<'inventoryUnits'>,
  reason: VacatedReason,
): Promise<Doc<'reservations'>[]> {
  const all = await fetchActiveReservations(ctx, bookingId)
  const active = all.filter((r) => r.inventoryUnitId === inventoryUnitId)

  if (active.length === 0) return []

  await releaseActiveReservations(ctx, active, reason)

  return active
}

const BATCH_SIZE = 25

export const findExpiredDrafts = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<{ bookingId: Id<'bookings'> }>> => {
    const now = Date.now()
    const staleDrafts = await ctx.db
      .query('bookings')
      .withIndex('by_status_expiresAt', (q) =>
        q.eq('status', BOOKING_STATUS.Draft).lt('expiresAt', now),
      )
      .filter((q) => q.neq(q.field('expiresAt'), undefined))
      .take(BATCH_SIZE)

    return staleDrafts.map((b) => ({ bookingId: b._id }))
  },
})

export const purgeOneDraft = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }): Promise<void> => {
    const booking = await ctx.db.get(bookingId)
    if (!booking || booking.status !== BOOKING_STATUS.Draft) return
    if (!canBookingTransition(booking.status, 'expire')) return

    await releaseBookingReservations(ctx, booking._id, VACATED_REASON.HoldExpired)
    await ctx.db.patch(booking._id, { status: BOOKING_STATUS.Cancelled }) // fsm-ok: guarded above
    await logBookingChange(ctx, {
      bookingId: booking._id,
      action: 'expired_draft_purged',
      actorSlug: 'system',
      actorType: 'system',
    })
  },
})

import { extractErrorCode, ISOLATABLE_ERRORS } from '../lib/errorCodes'

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
        if (!ISOLATABLE_ERRORS.has(errorCode)) {
          throw err
        }
        log.error('purgeExpiredDrafts: failed to purge booking', {
          bookingId,
          errorCode,
        })
        errors.push({ bookingId, errorCode })
      }
    }

    if (errors.length > 0) {
      log.error('purgeExpiredDrafts: batch completed with failures', {
        errorCount: errors.length,
        errors: errors.map((e) => `${e.bookingId}(${e.errorCode})`).join(', '),
      })
      await ctx.runMutation(internal.lib.alerts.sendAlert, {
        jobName: 'purge-expired-drafts',
        status: 'failure' as const,
        error: `Failed to purge ${errors.length} expired drafts: ${errors.map((e) => `${e.bookingId}(${e.errorCode})`).join(', ')}`,
      })
    }

    return { purged, skipped: errors.length, errors }
  },
})
