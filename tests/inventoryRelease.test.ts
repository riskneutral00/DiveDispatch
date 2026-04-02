import { describe, it, expect, beforeEach } from 'vitest'
import { releaseBookingReservations, releaseBookingReservationsByUnit } from '../convex/bookings/inventoryRelease'
import type { Doc } from '../convex/_generated/dataModel'
import { VACATED_REASON } from '../convex/shared/statuses'
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
      expect(snapB.availableUnits).toBe(1) // unchanged
      expect(snapB.reservedUnits).toBe(2) // unchanged
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
      expect(reservationB.status).toBe('Vacated')

      // Both snapshots restored
      const snapA = await ctx.db.get(snapshotA) as Doc<'availabilitySnapshots'>
      const snapB = await ctx.db.get(snapshotB) as Doc<'availabilitySnapshots'>
      expect(snapA.availableUnits).toBe(2)
      expect(snapA.reservedUnits).toBe(1)
      expect(snapB.availableUnits).toBe(2)
      expect(snapB.reservedUnits).toBe(1)
    })
  })

  it('no-op when booking has no active reservations', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Draft' })

      // Should not throw
      await releaseBookingReservations(ctx, bookingId, VACATED_REASON.HoldExpired)
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
    })
  })
})
