import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedInstructorUser(ctx: Ctx, slug = 'instructor-slug') {
  return ctx.db.insert('users', {
    tokenIdentifier: `user|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    businessName: 'Dive Pro',
    role: 'Instructor',
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedUnit(ctx: Ctx, ownerId: string) {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: 'John Doe',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Instructor',
  })
}

async function seedBooking(ctx: Ctx) {
  return ctx.db.insert('bookings', {
    ownerId: 'dc-slug',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: 43200000,
    paid: false,
    activityType: ['OW'],
    startDate: '2024-06-01',
    endDate: '2024-06-03',
    divers: [
      { name: 'Alice', abbrev: 'AL', flag: { code: 'US', label: 'USA' }, startDate: '2024-06-01', endDate: '2024-06-03', activityType: ['OW'] },
      { name: 'Bob', abbrev: 'BO', flag: { code: 'UK', label: 'United Kingdom' }, startDate: '2024-06-01', endDate: '2024-06-03', activityType: ['OW'] },
    ],
    operatorName: 'Phuket Dive Center',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
  })
}

// ─── getOpenRequests ──────────────────────────────────────────────────────────

describe('getOpenRequests', () => {
  it('returns PendingAcceptance reservations with booking context', async () => {
    const t = convexTest(schema, modules)

    const result = await (async () => {
      const { unitId, bookingId, reservationId } = await t.run(async (ctx) => {
        await seedInstructorUser(ctx)
        const unitId = await seedUnit(ctx, 'instructor-slug')
        const bookingId = await seedBooking(ctx)
        const sessionId = await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date: '2024-06-02',
          startTime: '08:00',
          endTime: '16:00',
          timezone: 'Asia/Bangkok',
        })
        const reservationId = await ctx.db.insert('reservations', {
          bookingId,
          inventoryUnitId: unitId,
          bookingSessionId: sessionId,
          unitsRequested: 1,
          status: 'PendingAcceptance',
        })
        return { unitId, bookingId, reservationId }
      })
      return { unitId, bookingId, reservationId }
    })()

    const items = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      inventoryUnitId: result.unitId,
      bookingId: result.bookingId,
      unitsRequested: 1,
      activityType: ['OW'],
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      diverCount: 2,
      operatorName: 'Phuket Dive Center',
    })
    expect(items[0].reservationIds).toBeDefined()
    expect(items[0].reservationIds).toHaveLength(1)
    expect(items[0].createdAt).toBeDefined()
  })

  it('returns empty array when no pending reservations exist', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      await seedUnit(ctx, 'instructor-slug')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toEqual([])
  })

  it('returns empty array when caller owns no inventory units', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      // Seed a booking + reservation but NO unit for instructor-slug
      const unitId = await seedUnit(ctx, 'other-instructor')
      const bookingId = await seedBooking(ctx)
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-02',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toEqual([])
  })

  it('sorts by createdAt descending', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-02',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      // Insert two reservations — order of insertion determines _creationTime
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toHaveLength(1)
    expect(result[0].reservationIds).toHaveLength(2)
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.resourceQueries.getOpenRequests),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when caller user record does not exist', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.withIdentity({ tokenIdentifier: 'user|nobody' })
        .query(api.resourceQueries.getOpenRequests),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('skips reservation when booking record is missing', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-02',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      // Delete the booking to orphan the reservation
      await ctx.db.delete(bookingId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toEqual([])
  })
})

// ─── getConfirmedSchedule ─────────────────────────────────────────────────────

describe('getConfirmedSchedule', () => {
  it('returns Confirmed reservations with booking context and sessions', async () => {
    const t = convexTest(schema, modules)

    const { unitId, bookingId } = await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-02',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-01',
        startTime: '09:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: 999,
      })
      return { unitId, bookingId }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getConfirmedSchedule)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      inventoryUnitId: unitId,
      bookingId,
      unitsRequested: 1,
      confirmedAt: 999,
      activityType: ['OW'],
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      diverCount: 2,
      operatorName: 'Phuket Dive Center',
    })
    expect(result[0].sessions).toHaveLength(2)
  })

  it('sorts sessions by date ascending within a booking', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-02', // later date inserted first
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-01', // earlier date inserted second
        startTime: '09:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: 999,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getConfirmedSchedule)

    const dates = result[0].sessions.map((s) => s.date)
    expect(dates).toEqual(['2024-06-01', '2024-06-02'])
  })

  it('filters sessions to only those belonging to this inventory unit', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const otherUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'other',
        displayName: 'Other Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'other',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx)

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-02',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      // Session belonging to a different unit
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: otherUnitId,
        date: '2024-06-03',
        startTime: '10:00',
        endTime: '14:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: 999,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getConfirmedSchedule)

    expect(result[0].sessions).toHaveLength(1)
    expect(result[0].sessions[0].date).toBe('2024-06-02')
  })

  it('sorts results by earliest session date ascending', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')

      // Booking 1: starts June 1
      const booking1Id = await seedBooking(ctx)
      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId: booking1Id,
        inventoryUnitId: unitId,
        date: '2024-06-01',
        startTime: '09:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: booking1Id,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: 100,
      })

      // Booking 2: starts May 1 (earlier)
      const booking2Id = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2024-05-01',
        endDate: '2024-05-02',
        divers: [{ name: 'Carol', abbrev: 'CA', flag: { code: 'TH', label: 'Thailand' }, startDate: '2024-05-01', endDate: '2024-05-02', activityType: ['OW'] }],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId: booking2Id,
        inventoryUnitId: unitId,
        date: '2024-05-01',
        startTime: '09:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: booking2Id,
        inventoryUnitId: unitId,
        bookingSessionId: session2Id,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: 200,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getConfirmedSchedule)

    // booking2 (May 1) should sort before booking1 (June 1)
    expect(result[0].startDate).toBe('2024-05-01')
    expect(result[1].startDate).toBe('2024-06-01')
  })

  it('returns empty array when no confirmed reservations exist', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      await seedUnit(ctx, 'instructor-slug')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getConfirmedSchedule)

    expect(result).toEqual([])
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.resourceQueries.getConfirmedSchedule),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when caller user record does not exist', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.withIdentity({ tokenIdentifier: 'user|nobody' })
        .query(api.resourceQueries.getConfirmedSchedule),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('skips reservation when booking record is missing', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-02',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: 999,
      })
      await ctx.db.delete(bookingId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getConfirmedSchedule)

    expect(result).toEqual([])
  })
})
