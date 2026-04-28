/**
 * @module-tag slow
 */

/**
 * L8-13: Unit tests for submitToDraft — atomic booking submission.
 *
 * Verifies:
 * 1. Sessions created for each day in the booking
 * 2. Reservations created for each assigned resource
 * 3. All-or-nothing: CONFLICT aborts entire mutation (zero partial holds)
 * 4. Booking status remains Draft after submitToDraft (bookingFormComplete=true)
 * 5. AvailabilitySnapshot updated in the same mutation as reservation write
 */

import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../../convex/lib/auth'
import { testDate } from '../helpers/dates'
import { makeT, expectConvexError } from '../helpers/convex-helpers'


type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

async function seedDcUser(ctx: Ctx, slug: string) {
  await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    firstName: slug,
    lastName: 'DC',
    dateOfBirth: '1990-01-01',
    appLanguage: 'en',
  })
}

async function seedInstructorUser(ctx: Ctx, slug: string) {
  await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    firstName: slug,
    lastName: 'Instructor',
    dateOfBirth: '1990-01-01',
    appLanguage: 'en',
  })
}

async function seedBooking(ctx: Ctx, ownerId: string): Promise<Id<'bookings'>> {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: testDate(5),
    endDate: testDate(5),
    divers: [],
    operatorName: `${ownerId} Business`,
    portalContact: true,
    portalMedical: true,
    portalWaiver: true,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
  })
}

async function seedInstructorUnit(ctx: Ctx, ownerId: string): Promise<Id<'inventoryUnits'>> {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: `${ownerId} Unit`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Instructor',
  })
}


describe('submitToDraft', () => {
  it('creates sessions for each day config', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedDcUser(ctx, 'dc-sub-1')
      await seedInstructorUser(ctx, 'inst-sub-1')
      const bookingId = await seedBooking(ctx, 'dc-sub-1')
      const unitId = await seedInstructorUnit(ctx, 'inst-sub-1')
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-sub-1' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          { inventoryUnitId: unitId, date: testDate(5), startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          { inventoryUnitId: unitId, date: testDate(6), startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          { inventoryUnitId: unitId, date: testDate(7), startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          { inventoryUnitId: unitId, date: testDate(8), startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
        ],
      },
    )

    await t.run(async (ctx) => {
      const allSessions = await ctx.db.query('bookingSessions').collect()
      const sessions = allSessions.filter((s) => s.bookingId === bookingId)
      expect(sessions).toHaveLength(4)
      const dates = sessions.map((s) => s.date).sort()
      expect(dates).toEqual([testDate(5), testDate(6), testDate(7), testDate(8)])
    })
  })

  it('creates reservations for each assigned resource', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedDcUser(ctx, 'dc-sub-2')
      await seedInstructorUser(ctx, 'inst-sub-2')
      const bookingId = await seedBooking(ctx, 'dc-sub-2')
      const unitId = await seedInstructorUnit(ctx, 'inst-sub-2')
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-sub-2' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          { inventoryUnitId: unitId, date: testDate(10), startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
        ],
      },
    )

    await t.run(async (ctx) => {
      const allReservations = await ctx.db.query('reservations').collect()
      const reservations = allReservations.filter((r) => r.bookingId === bookingId)
      expect(reservations).toHaveLength(1)
      expect(reservations[0].inventoryUnitId).toBe(unitId)
    })
  })

  it('is atomic — all-or-nothing on CONFLICT (no partial holds)', async () => {
    const t = makeT()

    const { bookingId2, unitId } = await t.run(async (ctx) => {
      await seedDcUser(ctx, 'dc-sub-3')
      await seedInstructorUser(ctx, 'inst-sub-3')

      await seedBooking(ctx, 'dc-sub-3')
      const bookingId2 = await seedBooking(ctx, 'dc-sub-3')
      const unitId = await seedInstructorUnit(ctx, 'inst-sub-3')

      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(15),
        windowStart: '08:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      return { bookingId2, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-sub-3' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
          sessions: [
            { inventoryUnitId: unitId, date: testDate(15), startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          ],
        },
      ),
      'CONFLICT',
    )

    await t.run(async (ctx) => {
      const allSessions = await ctx.db.query('bookingSessions').collect()
      const sessions = allSessions.filter((s) => s.bookingId === bookingId2)
      expect(sessions).toHaveLength(0)

      const allReservations = await ctx.db.query('reservations').collect()
      const reservations = allReservations.filter((r) => r.bookingId === bookingId2)
      expect(reservations).toHaveLength(0)
    })
  })

  it('sets bookingFormComplete=true and status remains Draft', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedDcUser(ctx, 'dc-sub-4')
      await seedInstructorUser(ctx, 'inst-sub-4')
      const bookingId = await seedBooking(ctx, 'dc-sub-4')
      const unitId = await seedInstructorUnit(ctx, 'inst-sub-4')
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-sub-4' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          { inventoryUnitId: unitId, date: testDate(20), startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
        ],
      },
    )

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking?.bookingFormComplete).toBe(true)
      expect(booking?.customerFormComplete).toBe(false)
      expect(booking?.status).toBe('Draft')
    })
  })

  it('snapshot updated in same mutation as reservation write (Invariant 3)', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedDcUser(ctx, 'dc-sub-5')
      await seedInstructorUser(ctx, 'inst-sub-5')
      const bookingId = await seedBooking(ctx, 'dc-sub-5')
      const unitId = await seedInstructorUnit(ctx, 'inst-sub-5')
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-sub-5' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          { inventoryUnitId: unitId, date: testDate(25), startTime: '09:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
        ],
      },
    )

    await t.run(async (ctx) => {
      const allSnapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snapshots = allSnapshots.filter((s) => s.inventoryUnitId === unitId)
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].availableUnits).toBe(0)
      expect(snapshots[0].reservedUnits).toBe(1)

      const allReservations = await ctx.db.query('reservations').collect()
      const reservations = allReservations.filter((r) => r.bookingId === bookingId)
      expect(reservations).toHaveLength(1)
    })
  })
})
