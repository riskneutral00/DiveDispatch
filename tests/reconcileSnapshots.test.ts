import { describe, it, expect, beforeEach, vi } from 'vitest'
import { internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { testDate } from './helpers/dates'
import {
  seedBooking,
  seedSession,
  seedReservation,
  seedInventoryUnit,
  seedSnapshot,
} from './fixtures'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

describe('reconcileSnapshots', () => {
  it('returns 0 discrepancies when snapshot matches active reservations', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor Alpha',
      })

      const date = testDate(5)
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, date })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
    })

    const result = await t.mutation(internal.reconciliation.reconcileSnapshots, {})
    expect(result.checked).toBe(1)
    expect(result.discrepancies).toBe(0)
  })

  it('counts PendingAcceptance reservations toward actual reserved', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor Alpha',
      })

      const date = testDate(5)
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, date })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
    })

    const result = await t.mutation(internal.reconciliation.reconcileSnapshots, {})
    expect(result.checked).toBe(1)
    expect(result.discrepancies).toBe(0)
  })

  it('sums unitsRequested across multiple reservations for the same unit and date', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor Alpha',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })

      const date = testDate(5)
      await seedSnapshot(ctx, unitId, { reservedUnits: 3, totalUnits: 10, date })

      const bookingA = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionA = await seedSession(ctx, bookingA, unitId, { date })
      await seedReservation(ctx, bookingA, unitId, sessionA, { status: 'Confirmed', unitsRequested: 2 })

      const bookingB = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionB = await seedSession(ctx, bookingB, unitId, { date })
      await seedReservation(ctx, bookingB, unitId, sessionB, { status: 'PendingAcceptance' })
    })

    const result = await t.mutation(internal.reconciliation.reconcileSnapshots, {})
    expect(result.checked).toBe(1)
    expect(result.discrepancies).toBe(0)
  })

  it('writes success cronRunLog entry when no discrepancies', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor Alpha',
      })

      const date = testDate(5)
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, date })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
    })

    await t.mutation(internal.reconciliation.reconcileSnapshots, {})

    const logs = await t.run(async (ctx) =>
      ctx.db.query('cronRunLog').collect(),
    )
    expect(logs).toHaveLength(1)
    expect(logs[0].jobName).toBe('reconcile-snapshots')
    expect(logs[0].status).toBe('success')
  })

  it('skips snapshots with reservedUnits = 0', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor Alpha',
      })

      await seedSnapshot(ctx, unitId, { reservedUnits: 0, date: testDate(5) })
    })

    const result = await t.mutation(internal.reconciliation.reconcileSnapshots, {})
    expect(result.checked).toBe(0)
    expect(result.discrepancies).toBe(0)
  })
})
