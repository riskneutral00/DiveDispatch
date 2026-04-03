import { describe, it, expect, beforeEach } from 'vitest'
import { releaseBookingReservations, releaseBookingReservationsByUnit, restoreSnapshotUnits } from '../convex/bookings/inventoryRelease'
import type { Doc } from '../convex/_generated/dataModel'
import { VACATED_REASON } from '../convex/shared/statuses'
import { ErrorCode } from '../convex/lib/errorCodes'
import {
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
  seedBooking,
  seedSession,
  seedReservation,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

describe('releaseBookingReservations', () => {
  it('targeted release: only vacates reservations for the specified inventoryUnitId', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unitA = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat A' })
      const unitB = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat B' })
      const snapshotA = await seedSnapshot(ctx, unitA, { totalUnits: 3, availableUnits: 1, reservedUnits: 2 })
      const snapshotB = await seedSnapshot(ctx, unitB, { totalUnits: 3, availableUnits: 1, reservedUnits: 2 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionA = await seedSession(ctx, bookingId, unitA)
      const sessionB = await seedSession(ctx, bookingId, unitB)
      const resA = await seedReservation(ctx, bookingId, unitA, sessionA, { status: 'Confirmed' })
      const resB = await seedReservation(ctx, bookingId, unitB, sessionB, { status: 'Confirmed' })

      // Release only unit A's reservations (decline path)
      await releaseBookingReservationsByUnit(ctx, bookingId, unitA, VACATED_REASON.StakeholderDeclined)

      const reservationA = await ctx.db.get(resA) as Doc<'reservations'>
      const reservationB = await ctx.db.get(resB) as Doc<'reservations'>

      expect(reservationA.status).toBe('Vacated')
      expect(reservationA.vacatedBy).toBe(VACATED_REASON.StakeholderDeclined)
      expect(reservationB.status).toBe('Confirmed') // untouched

      // Snapshot A restored, snapshot B unchanged
      const snapA = await ctx.db.get(snapshotA) as Doc<'availabilitySnapshots'>
      const snapB = await ctx.db.get(snapshotB) as Doc<'availabilitySnapshots'>
      expect(snapA.availableUnits).toBe(2)
      expect(snapA.reservedUnits).toBe(1)
      expect(snapA.totalUnits).toBe(3)
      expect(snapB.availableUnits).toBe(1) // unchanged
      expect(snapB.reservedUnits).toBe(2) // unchanged
      expect(snapB.totalUnits).toBe(3)
    })
  })

  it('full release: vacates all reservations when no inventoryUnitId provided', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unitA = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat A' })
      const unitB = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat B' })
      const snapshotA = await seedSnapshot(ctx, unitA, { totalUnits: 3, availableUnits: 1, reservedUnits: 2 })
      const snapshotB = await seedSnapshot(ctx, unitB, { totalUnits: 3, availableUnits: 1, reservedUnits: 2 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionA = await seedSession(ctx, bookingId, unitA)
      const sessionB = await seedSession(ctx, bookingId, unitB)
      const resA = await seedReservation(ctx, bookingId, unitA, sessionA, { status: 'PendingAcceptance' })
      const resB = await seedReservation(ctx, bookingId, unitB, sessionB, { status: 'Confirmed' })

      // Full release — no inventoryUnitId (cancel/expire/edit path)
      await releaseBookingReservations(ctx, bookingId, VACATED_REASON.BookingCancelled)

      const reservationA = await ctx.db.get(resA) as Doc<'reservations'>
      const reservationB = await ctx.db.get(resB) as Doc<'reservations'>

      expect(reservationA.status).toBe('Vacated')
      expect(reservationA.vacatedBy).toBe(VACATED_REASON.BookingCancelled)
      expect(reservationB.status).toBe('Vacated')
      expect(reservationB.vacatedBy).toBe(VACATED_REASON.BookingCancelled)

      // Both snapshots restored
      const snapA = await ctx.db.get(snapshotA) as Doc<'availabilitySnapshots'>
      const snapB = await ctx.db.get(snapshotB) as Doc<'availabilitySnapshots'>
      expect(snapA.availableUnits).toBe(2)
      expect(snapA.reservedUnits).toBe(1)
      expect(snapA.totalUnits).toBe(3)
      expect(snapB.availableUnits).toBe(2)
      expect(snapB.reservedUnits).toBe(1)
      expect(snapB.totalUnits).toBe(3)
    })
  })

  it('no-op when booking has no active reservations', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 2, displayName: 'Boat C' })
      const snapshot = await seedSnapshot(ctx, unit, { totalUnits: 2, availableUnits: 2, reservedUnits: 0 })
      const bookingId = await seedBooking(ctx, { status: 'Draft' })

      await releaseBookingReservations(ctx, bookingId, VACATED_REASON.HoldExpired)

      // Booking still exists
      const booking = await ctx.db.get(bookingId)
      expect(booking).not.toBeNull()
      expect(booking!._id).toEqual(bookingId)

      // No reservations were vacated — none exist for this booking
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect()
      expect(reservations).toHaveLength(0)

      // Snapshot counts are unchanged
      const snap = await ctx.db.get(snapshot) as Doc<'availabilitySnapshots'>
      expect(snap.availableUnits).toBe(2)
      expect(snap.reservedUnits).toBe(0)
      expect(snap.totalUnits).toBe(2)
    })
  })

  it('targeted release skips already-vacated reservations', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat' })
      const snapshot = await seedSnapshot(ctx, unit, { totalUnits: 3, availableUnits: 2, reservedUnits: 1 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const session = await seedSession(ctx, bookingId, unit)
      await seedReservation(ctx, bookingId, unit, session, { status: 'Vacated' })

      // No active reservations for this unit — should be a no-op
      await releaseBookingReservationsByUnit(ctx, bookingId, unit, VACATED_REASON.StakeholderDeclined)

      const snap = await ctx.db.get(snapshot) as Doc<'availabilitySnapshots'>
      expect(snap.availableUnits).toBe(2) // unchanged
      expect(snap.reservedUnits).toBe(1) // unchanged
      expect(snap.totalUnits).toBe(3)
    })
  })

  it('throws SNAPSHOT_UNDERFLOW when reservation unitsRequested exceeds snapshot reservedUnits (DD-278)', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat' })
      // Snapshot has only 1 reserved unit
      const snapshotId = await seedSnapshot(ctx, unit, { totalUnits: 3, availableUnits: 2, reservedUnits: 1 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const session = await seedSession(ctx, bookingId, unit)
      // Reservation claims 2 units — exceeds the 1 reserved in the snapshot
      await seedReservation(ctx, bookingId, unit, session, { status: 'Confirmed', unitsRequested: 2 })

      await expect(
        releaseBookingReservations(ctx, bookingId, VACATED_REASON.BookingCancelled),
      ).rejects.toMatchObject({
        data: {
          code: ErrorCode.SNAPSHOT_UNDERFLOW,
        },
      })

      // Snapshot must not have been mutated — no partial write
      const snap = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'>
      expect(snap.availableUnits).toBe(2)
      expect(snap.reservedUnits).toBe(1)
      expect(snap.totalUnits).toBe(3)
    })
  })

  it('throws SNAPSHOT_DOUBLE_WRITE when restoreSnapshotUnits is called twice with the same snapshotId (DD-278 accumulation bug guard)', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat' })
      const snapshotId = await seedSnapshot(ctx, unit, { totalUnits: 3, availableUnits: 1, reservedUnits: 2 })

      const seenSnapshotIds = new Set<string>()

      // First call succeeds — snapshot is processed and the ID is recorded in the set
      await restoreSnapshotUnits(ctx, snapshotId, 1, seenSnapshotIds)

      // Second call with the same snapshotId must throw — double-write detected
      await expect(
        restoreSnapshotUnits(ctx, snapshotId, 1, seenSnapshotIds),
      ).rejects.toMatchObject({
        data: {
          code: ErrorCode.SNAPSHOT_DOUBLE_WRITE,
        },
      })
    })
  })

  it('throws ORPHANED_RESERVATION when a reservation references a deleted session', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 2, displayName: 'Boat' })
      const snapshotId = await seedSnapshot(ctx, unit, { totalUnits: 2, availableUnits: 1, reservedUnits: 1 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      // Create a session, reference it in a reservation, then delete the session to simulate an orphan.
      const sessionId = await seedSession(ctx, bookingId, unit)
      await seedReservation(ctx, bookingId, unit, sessionId, { status: 'Confirmed', unitsRequested: 1 })
      await ctx.db.delete(sessionId)

      await expect(
        releaseBookingReservations(ctx, bookingId, VACATED_REASON.BookingCancelled),
      ).rejects.toMatchObject({
        data: {
          code: ErrorCode.ORPHANED_RESERVATION,
        },
      })

      // Snapshot must not have been mutated — mutation rolls back atomically
      const snap = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'>
      expect(snap.availableUnits).toBe(1)
      expect(snap.reservedUnits).toBe(1)
      expect(snap.totalUnits).toBe(2)
    })
  })

  it('accumulates units across two reservations sharing the same snapshot before patching once', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat' })
      // Snapshot starts with 2 reserved units — one per reservation below
      const snapshotId = await seedSnapshot(ctx, unit, { totalUnits: 3, availableUnits: 1, reservedUnits: 2 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      // Both reservations share the same session — same (inventoryUnitId, date, windowStart) key
      const session = await seedSession(ctx, bookingId, unit)
      await seedReservation(ctx, bookingId, unit, session, { status: 'Confirmed', unitsRequested: 1 })
      await seedReservation(ctx, bookingId, unit, session, { status: 'Confirmed', unitsRequested: 1 })

      await releaseBookingReservations(ctx, bookingId, VACATED_REASON.BookingCancelled)

      // Snapshot must be patched once with the accumulated total (2), not twice with 1 each.
      // A double-patch bug would throw SNAPSHOT_DOUBLE_WRITE; wrong accumulation would leave
      // reservedUnits at 1 instead of 0.
      const snap = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'>
      expect(snap.availableUnits).toBe(3)
      expect(snap.reservedUnits).toBe(0)
      expect(snap.totalUnits).toBe(3)
    })
  })

  it('throws MISSING_SNAPSHOT_ON_RELEASE when snapshot disappears between lookup and restore (Invariant 3 guard)', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 2, displayName: 'Boat' })
      // Create the snapshot so seedReservation can reference it, then delete it to simulate
      // the TOCTOU gap: snapshot existed at reservation creation but is gone at release time.
      const snapshotId = await seedSnapshot(ctx, unit, { totalUnits: 2, availableUnits: 1, reservedUnits: 1 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const session = await seedSession(ctx, bookingId, unit)
      const resId = await seedReservation(ctx, bookingId, unit, session, { status: 'Confirmed', unitsRequested: 1 })

      // Delete the snapshot to simulate it disappearing before the restore step.
      await ctx.db.delete(snapshotId)

      // restoreSnapshotUnits is called after reservations are vacated; throwing here causes
      // the entire mutation to roll back (Convex atomicity guarantees).
      await expect(
        restoreSnapshotUnits(ctx, snapshotId, 1),
      ).rejects.toMatchObject({
        data: {
          code: ErrorCode.MISSING_SNAPSHOT_ON_RELEASE,
        },
      })

      // Reservation must NOT be vacated — the mutation never committed the vacate writes.
      const reservation = await ctx.db.get(resId) as Doc<'reservations'>
      expect(reservation.status).toBe('Confirmed')
      expect(reservation.status).not.toBe('Vacated')
    })
  })
})
