import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { isFullDayResource } from '../convex/bookings/_shared'
import { testDate } from './helpers/dates'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { seedUser, seedBooking, seedInventoryUnit, seedSnapshot } from './fixtures'

describe('Invariant 1 — Exclusive unit double-hold prevention', () => {
  it('H3-1: second booking on same exclusive instructor + overlapping window throws CONFLICT', async () => {
    const t = makeT()

    const { bookingId1, bookingId2, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-inv', tokenIdentifier: 'clerk|dc-inv' })
      const bookingId1 = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const bookingId2 = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-excl',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Exclusive Instructor',
      })
      return { bookingId1, bookingId2, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: bookingId1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )

    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snap = snapshots.find(
        (s) => s.inventoryUnitId === unitId && s.date === testDate(5),
      )
      expect(snap!.availableUnits).toBe(0)
      expect(snap!.reservedUnits).toBe(1)
    })
  })
})

describe('Invariant 1b — Exclusive unit rejects unitsRequested > 1', () => {
  it('H3-1b: Exclusive unit with unitsRequested=2 throws INVALID_INPUT', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-inv', tokenIdentifier: 'clerk|dc-inv' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-excl-guard',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Exclusive Guard Test',
      })
      return { bookingId, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 2,
            },
          ],
        },
      ),
      'INVALID_INPUT',
    )
  })
})

describe('Invariant 2 — Pooled inventory zero-blocking', () => {
  it('H3-2: boat with 5 seats — five 1-seat bookings succeed, sixth throws CONFLICT', async () => {
    const t = makeT()

    const { bookingIds, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-inv', tokenIdentifier: 'clerk|dc-inv' })
      const bookingIds = []
      for (let i = 0; i < 6; i++) {
        bookingIds.push(await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] }))
      }
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'boat-pool-5',
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'Boat 5-seat',
        capacityModel: 'Pooled',
        totalUnits: 5,
      })
      return { bookingIds, unitId }
    })

    for (let i = 0; i < 5; i++) {
      await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingIds[i],
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      )
    }

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingIds[5],
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )

    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snap = snapshots.find(
        (s) => s.inventoryUnitId === unitId && s.date === testDate(5),
      )
      expect(snap!.availableUnits).toBe(0)
      expect(snap!.reservedUnits).toBe(5)
    })
  })

  it('H3-3: pooled partial — request 3 of 5 succeeds, second request for 3 throws CONFLICT', async () => {
    const t = makeT()

    const { bookingId1, bookingId2, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-inv', tokenIdentifier: 'clerk|dc-inv' })
      const bookingId1 = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const bookingId2 = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'boat-partial',
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'Boat 5-seat partial',
        capacityModel: 'Pooled',
        totalUnits: 5,
      })
      return { bookingId1, bookingId2, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: bookingId1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 3,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snap = snapshots.find(
        (s) => s.inventoryUnitId === unitId && s.date === testDate(5),
      )
      expect(snap!.availableUnits).toBe(2)
      expect(snap!.reservedUnits).toBe(3)
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 3,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })
})

describe('Invariant 3 — Atomicity on CONFLICT', () => {
  it('H3-4: after CONFLICT throw, zero writes (no reservation, no snapshot change, no session)', async () => {
    const t = makeT()

    const { bookingId, unitId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-inv', tokenIdentifier: 'clerk|dc-inv' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-atom',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor Atomicity',
      })
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId, unitId, snapshotId }
    })

    const [reservationCountBefore, sessionCountBefore, snapshotBefore] = await t.run(
      async (ctx) => {
        const reservations = await ctx.db.query('reservations').collect()
        const sessions = await ctx.db.query('bookingSessions').collect()
        const snapshot = await ctx.db.get(snapshotId)
        return [reservations.length, sessions.length, snapshot]
      },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations.length).toBe(reservationCountBefore)

      const sessions = await ctx.db.query('bookingSessions').collect()
      expect(sessions.length).toBe(sessionCountBefore)

      const snapshot = await ctx.db.get(snapshotId)
      expect(snapshot!.availableUnits).toBe(snapshotBefore!.availableUnits)
      expect(snapshot!.reservedUnits).toBe(snapshotBefore!.reservedUnits)
    })
  })
})

describe('Full-day blocking — day boat', () => {
  it('H3-5: day boat booked for morning — afternoon booking on same date throws CONFLICT', async () => {
    const t = makeT()

    const { bookingId1, bookingId2, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-inv', tokenIdentifier: 'clerk|dc-inv' })
      const bookingId1 = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const bookingId2 = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'day-boat-full',
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'Day Boat Full',
        capacityModel: 'Pooled',
        totalUnits: 5,
        boatType: 'day_boat',
      })
      return { bookingId1, bookingId2, unitId }
    })

    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'day_boat' })).toBe(true)

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: bookingId1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '12:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 5,
          },
        ],
      },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '13:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })
})

describe('Lazy snapshot creation', () => {
  it('H3-6: first booking on unit with no pre-existing snapshot creates one correctly', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-inv', tokenIdentifier: 'clerk|dc-inv' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-inv', bookingFormComplete: false, divers: [] })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'boat-lazy',
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'Boat Lazy Snap',
        capacityModel: 'Pooled',
        totalUnits: 5,
      })
      return { bookingId, unitId }
    })

    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(0)
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].availableUnits).toBe(4)
      expect(snapshots[0].reservedUnits).toBe(1)
      expect(snapshots[0].totalUnits).toBe(5)
    })
  })
})
