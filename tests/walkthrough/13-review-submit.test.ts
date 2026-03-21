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

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000

function makeT() {
  return convexTest(schema, import.meta.glob('../../convex/**/*.ts'))
}

type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

async function seedDcUser(ctx: Ctx, slug: string) {
  await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} DC`,
    firstName: slug,
    lastName: 'DC',
    businessName: `${slug} Business`,
    role: 'DiveCenter',
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedInstructorUser(ctx: Ctx, slug: string) {
  await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Instructor`,
    firstName: slug,
    lastName: 'Instructor',
    businessName: `${slug} Teaching`,
    role: 'Instructor',
    isSeeded: false,
    preferredLocale: 'en',
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
    startDate: '2030-07-01',
    endDate: '2030-07-01',
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

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

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

    // Submit with 4 sessions (4-day course)
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-sub-1' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          { inventoryUnitId: unitId, date: '2030-07-01', startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          { inventoryUnitId: unitId, date: '2030-07-02', startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          { inventoryUnitId: unitId, date: '2030-07-03', startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          { inventoryUnitId: unitId, date: '2030-07-04', startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
        ],
      },
    )

    await t.run(async (ctx) => {
      const allSessions = await ctx.db.query('bookingSessions').collect()
      const sessions = allSessions.filter((s) => s.bookingId === bookingId)
      expect(sessions).toHaveLength(4)
      const dates = sessions.map((s) => s.date).sort()
      expect(dates).toEqual(['2030-07-01', '2030-07-02', '2030-07-03', '2030-07-04'])
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
          { inventoryUnitId: unitId, date: '2030-07-10', startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
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

      // Pre-hold the unit — unit is fully booked on 2030-07-15
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: '2030-07-15',
        windowStart: '08:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      return { bookingId2, unitId }
    })

    // Attempt to book a fully-held unit — should throw CONFLICT
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-sub-3' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
          sessions: [
            { inventoryUnitId: unitId, date: '2030-07-15', startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
          ],
        },
      ),
      'CONFLICT',
    )

    // Zero sessions/reservations written for the failed booking
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
          { inventoryUnitId: unitId, date: '2030-07-20', startTime: '08:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
        ],
      },
    )

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      // bookingFormComplete is set
      expect(booking?.bookingFormComplete).toBe(true)
      // customerFormComplete is still false — no portal submission yet
      expect(booking?.customerFormComplete).toBe(false)
      // status stays Draft (customerFormComplete=false prevents auto-advance)
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
          { inventoryUnitId: unitId, date: '2030-07-25', startTime: '09:00', endTime: '17:00', timezone: 'Asia/Bangkok', unitsRequested: 1 },
        ],
      },
    )

    await t.run(async (ctx) => {
      // Snapshot was created atomically — availableUnits decremented
      const allSnapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snapshots = allSnapshots.filter((s) => s.inventoryUnitId === unitId)
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].availableUnits).toBe(0)
      expect(snapshots[0].reservedUnits).toBe(1)

      // Reservation was written in the same mutation
      const allReservations = await ctx.db.query('reservations').collect()
      const reservations = allReservations.filter((r) => r.bookingId === bookingId)
      expect(reservations).toHaveLength(1)
    })
  })
})
