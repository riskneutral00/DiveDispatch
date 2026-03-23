import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { testDate } from './helpers/dates'

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
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [
      { name: 'Alice', abbrev: 'AL', flag: { code: 'US', label: 'USA' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
      { name: 'Bob', abbrev: 'BO', flag: { code: 'UK', label: 'United Kingdom' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
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
          date: testDate(6),
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
      startDate: testDate(5),
      endDate: testDate(7),
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
        date: testDate(6),
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
        date: testDate(6),
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
        date: testDate(6),
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

  it('excludes Confirmed and Vacated reservations — only PendingAcceptance returned', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      // Confirmed reservation — should NOT appear
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })
      // Vacated reservation — should NOT appear
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Vacated',
        vacatedBy: 'hold_expired',
        vacatedAt: Date.now(),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toEqual([])
  })

  it('groups multi-day reservations by booking+unit into a single OpenRequest', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)
      // Day 1 session + reservation
      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      // Day 2 session + reservation (same booking, same unit)
      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session2Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { bookingId, unitId }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    // Two reservations on the same booking+unit should group into one OpenRequest
    expect(result).toHaveLength(1)
    expect(result[0].reservationIds).toHaveLength(2)
    expect(result[0].bookingId).toBe(bookingId)
    expect(result[0].inventoryUnitId).toBe(unitId)
  })

  it('returns separate OpenRequests for different bookings', async () => {
    const t = convexTest(schema, modules)
    const { booking1Id, booking2Id } = await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      // Booking 1
      const booking1Id = await seedBooking(ctx)
      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId: booking1Id,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: booking1Id,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      // Booking 2
      const booking2Id = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['AOW'],
        startDate: testDate(10),
        endDate: testDate(12),
        divers: [
          { name: 'Carol', abbrev: 'CA', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(10), endDate: testDate(12), activityType: ['AOW'] },
        ],
        operatorName: 'Koh Tao Dive Center',
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
        date: testDate(10),
        startTime: '09:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: booking2Id,
        inventoryUnitId: unitId,
        bookingSessionId: session2Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { booking1Id, booking2Id }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toHaveLength(2)
    const bookingIds = result.map(r => r.bookingId)
    expect(bookingIds).toContain(booking1Id)
    expect(bookingIds).toContain(booking2Id)
    // Verify each booking's context is distinct
    const booking2Result = result.find(r => r.bookingId === booking2Id)
    expect(booking2Result).toMatchObject({
      activityType: ['AOW'],
      startDate: testDate(10),
      endDate: testDate(12),
      diverCount: 1,
      operatorName: 'Koh Tao Dive Center',
    })
  })

  it('sorts newest booking first when multiple bookings exist', async () => {
    const t = convexTest(schema, modules)
    const { booking1Id, booking2Id } = await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      // Booking 1 (created first — older)
      const booking1Id = await seedBooking(ctx)
      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId: booking1Id,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: booking1Id,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      // Booking 2 (created second — newer, should sort first)
      const booking2Id = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['FD'],
        startDate: testDate(10),
        endDate: testDate(10),
        divers: [
          { name: 'Dave', abbrev: 'DA', flag: { code: 'AU', label: 'Australia' }, startDate: testDate(10), endDate: testDate(10), activityType: ['FD'] },
        ],
        operatorName: 'Another DC',
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
        date: testDate(10),
        startTime: '09:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: booking2Id,
        inventoryUnitId: unitId,
        bookingSessionId: session2Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { booking1Id, booking2Id }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    // Newest (booking2) should appear first (descending createdAt sort)
    expect(result).toHaveLength(2)
    expect(result[0].bookingId).toBe(booking2Id)
    expect(result[1].bookingId).toBe(booking1Id)
  })

  it('aggregates requests across multiple owned inventory units', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      // Instructor owns two units (e.g. instructor unit + equipment unit)
      const unit1Id = await seedUnit(ctx, 'instructor-slug')
      const unit2Id = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Equipment',
        resourceId: 'instructor-slug',
        displayName: 'Instructor Equipment',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx)
      // Reservation on unit 1
      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit1Id,
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit1Id,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      // Reservation on unit 2 (same booking, different unit)
      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit2Id,
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit2Id,
        bookingSessionId: session2Id,
        unitsRequested: 3,
        status: 'PendingAcceptance',
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    // Same booking but different units → two separate OpenRequests
    expect(result).toHaveLength(2)
    const requested = result.map(r => r.unitsRequested).sort()
    expect(requested).toEqual([1, 3])
  })

  it('uses max createdAt when grouping multi-day reservations', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      const bookingId = await seedBooking(ctx)
      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      // Insert two reservations — second has later _creationTime
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session2Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toHaveLength(1)
    // createdAt should be set (the max of both _creationTimes)
    expect(typeof result[0].createdAt).toBe('number')
    expect(result[0].createdAt).toBeGreaterThan(0)
  })

  it('returns correct diverCount from booking divers array length', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      // Booking with 3 divers
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'US', label: 'USA' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'Bob', abbrev: 'BO', flag: { code: 'UK', label: 'United Kingdom' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'Carol', abbrev: 'CA', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
        ],
        operatorName: 'Triple Diver DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(6),
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

    expect(result).toHaveLength(1)
    expect(result[0].diverCount).toBe(3)
    expect(result[0].operatorName).toBe('Triple Diver DC')
  })

  it('mixes PendingAcceptance with other statuses on same unit — only returns pending', async () => {
    const t = convexTest(schema, modules)
    const { pendingBookingId } = await t.run(async (ctx) => {
      await seedInstructorUser(ctx)
      const unitId = await seedUnit(ctx, 'instructor-slug')
      // Booking with Confirmed reservation
      const confirmedBookingId = await seedBooking(ctx)
      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId: confirmedBookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: confirmedBookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })
      // Different booking with PendingAcceptance reservation
      const pendingBookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['FD'],
        startDate: testDate(8),
        endDate: testDate(8),
        divers: [
          { name: 'Eve', abbrev: 'EV', flag: { code: 'DE', label: 'Germany' }, startDate: testDate(8), endDate: testDate(8), activityType: ['FD'] },
        ],
        operatorName: 'Fun Dive DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId: pendingBookingId,
        inventoryUnitId: unitId,
        date: testDate(8),
        startTime: '09:00',
        endTime: '12:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId: pendingBookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session2Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { pendingBookingId }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|instructor-slug' })
      .query(api.resourceQueries.getOpenRequests)

    expect(result).toHaveLength(1)
    expect(result[0].bookingId).toBe(pendingBookingId)
    expect(result[0].activityType).toEqual(['FD'])
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
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
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
      startDate: testDate(5),
      endDate: testDate(7),
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
        date: testDate(6), // later date inserted first
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5), // earlier date inserted second
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
    expect(dates).toEqual([testDate(5), testDate(6)])
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
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      // Session belonging to a different unit
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: otherUnitId,
        date: testDate(7),
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
    expect(result[0].sessions[0].date).toBe(testDate(6))
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
        date: testDate(5),
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
        startDate: testDate(3),
        endDate: testDate(4),
        divers: [{ name: 'Carol', abbrev: 'CA', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(3), endDate: testDate(4), activityType: ['OW'] }],
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
        date: testDate(3),
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
    expect(result[0].startDate).toBe(testDate(3))
    expect(result[1].startDate).toBe(testDate(5))
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
        date: testDate(6),
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
