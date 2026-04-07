import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { testDate } from './helpers/dates'
import { makeT } from './helpers/convex-helpers'
import {
  seedUser,
  seedInventoryUnit,
  seedBooking,
  seedSession,
  seedReservation,
} from './fixtures'

const INSTRUCTOR_SLUG = 'instructor-slug'
const INSTRUCTOR_TOKEN = `user|${INSTRUCTOR_SLUG}`
const DC_SLUG = 'dc-slug'

const DEFAULT_DIVERS = [
  { name: 'Alice', abbrev: 'AL', flag: { code: 'US', label: 'USA' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] as string[] },
  { name: 'Bob', abbrev: 'BO', flag: { code: 'UK', label: 'United Kingdom' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] as string[] },
]

describe('getOpenRequests', () => {
  it('returns PendingAcceptance reservations with booking context', async () => {
    const t = makeT()

    const result = await (async () => {
      const { unitId, bookingId, reservationId } = await t.run(async (ctx) => {
        await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
        const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
        const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
        const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
        const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
        return { unitId, bookingId, reservationId }
      })
      return { unitId, bookingId, reservationId }
    })()

    const items = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

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
    expect(items[0].reservationIds).toHaveLength(1)
    expect(typeof items[0].createdAt).toBe('number')
  })

  it('returns empty array when no pending reservations exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toEqual([])
  })

  it('returns empty array when caller owns no inventory units', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: 'other-instructor', ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toEqual([])
  })

  it('sorts by createdAt descending', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(1)
    expect(result[0].reservationIds).toHaveLength(2)
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when caller user record does not exist', async () => {
    const t = makeT()

    await expect(
      t.withIdentity({ tokenIdentifier: 'user|nobody' })
        .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('skips reservation when booking record is missing', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
      await ctx.db.delete(bookingId)
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toEqual([])
  })

  it('excludes Confirmed and Vacated reservations — only PendingAcceptance returned', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed', confirmedAt: Date.now() })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Vacated', vacatedBy: 'hold_expired', vacatedAt: Date.now() })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toEqual([])
  })

  it('groups multi-day reservations by booking+unit into a single OpenRequest', async () => {
    const t = makeT()
    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const session1Id = await seedSession(ctx, bookingId, unitId, { date: testDate(5), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, session1Id, { status: 'PendingAcceptance' })
      const session2Id = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, session2Id, { status: 'PendingAcceptance' })
      return { bookingId, unitId }
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(1)
    expect(result[0].reservationIds).toHaveLength(2)
    expect(result[0].bookingId).toBe(bookingId)
    expect(result[0].inventoryUnitId).toBe(unitId)
  })

  it('returns separate OpenRequests for different bookings', async () => {
    const t = makeT()
    const { booking1Id, booking2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const booking1Id = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const session1Id = await seedSession(ctx, booking1Id, unitId, { date: testDate(5), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, booking1Id, unitId, session1Id, { status: 'PendingAcceptance' })
      const booking2Id = await seedBooking(ctx, {
        ownerId: DC_SLUG,
        bookingFormComplete: false,
        activityType: ['AOW'],
        startDate: testDate(10),
        endDate: testDate(12),
        divers: [
          { name: 'Carol', abbrev: 'CA', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(10), endDate: testDate(12), activityType: ['AOW'] },
        ],
        operatorName: 'Koh Tao Dive Center',
      })
      const session2Id = await seedSession(ctx, booking2Id, unitId, { date: testDate(10), startTime: '09:00', endTime: '12:00' })
      await seedReservation(ctx, booking2Id, unitId, session2Id, { status: 'PendingAcceptance' })
      return { booking1Id, booking2Id }
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(2)
    const bookingIds = result.map(r => r.bookingId)
    expect(bookingIds).toContain(booking1Id)
    expect(bookingIds).toContain(booking2Id)
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
    const t = makeT()
    const { booking1Id, booking2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const booking1Id = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const session1Id = await seedSession(ctx, booking1Id, unitId, { date: testDate(5), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, booking1Id, unitId, session1Id, { status: 'PendingAcceptance' })
      const booking2Id = await seedBooking(ctx, {
        ownerId: DC_SLUG,
        bookingFormComplete: false,
        activityType: ['FD'],
        startDate: testDate(10),
        endDate: testDate(10),
        divers: [
          { name: 'Dave', abbrev: 'DA', flag: { code: 'AU', label: 'Australia' }, startDate: testDate(10), endDate: testDate(10), activityType: ['FD'] },
        ],
        operatorName: 'Another DC',
      })
      const session2Id = await seedSession(ctx, booking2Id, unitId, { date: testDate(10), startTime: '09:00', endTime: '12:00' })
      await seedReservation(ctx, booking2Id, unitId, session2Id, { status: 'PendingAcceptance' })
      return { booking1Id, booking2Id }
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(2)
    expect(result[0].bookingId).toBe(booking2Id)
    expect(result[1].bookingId).toBe(booking1Id)
  })

  it('aggregates requests across multiple owned inventory units', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unit1Id = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const unit2Id = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Equipment', displayName: 'Instructor Equipment', capacityModel: 'Pooled', totalUnits: 5 })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const session1Id = await seedSession(ctx, bookingId, unit1Id, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unit1Id, session1Id, { status: 'PendingAcceptance' })
      const session2Id = await seedSession(ctx, bookingId, unit2Id, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unit2Id, session2Id, { status: 'PendingAcceptance', unitsRequested: 3 })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(2)
    const requested = result.map(r => r.unitsRequested).sort()
    expect(requested).toEqual([1, 3])
  })

  it('uses max createdAt when grouping multi-day reservations', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const session1Id = await seedSession(ctx, bookingId, unitId, { date: testDate(5), startTime: '08:00', endTime: '16:00' })
      const session2Id = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, session1Id, { status: 'PendingAcceptance' })
      await seedReservation(ctx, bookingId, unitId, session2Id, { status: 'PendingAcceptance' })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(1)
    expect(typeof result[0].createdAt).toBe('number')
    expect(result[0].createdAt).toBeGreaterThan(0)
  })

  it('returns correct diverCount from booking divers array length', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, {
        ownerId: DC_SLUG,
        bookingFormComplete: false,
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'US', label: 'USA' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'Bob', abbrev: 'BO', flag: { code: 'UK', label: 'United Kingdom' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'Carol', abbrev: 'CA', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
        ],
        operatorName: 'Triple Diver DC',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(1)
    expect(result[0].diverCount).toBe(3)
    expect(result[0].operatorName).toBe('Triple Diver DC')
  })

  it('mixes PendingAcceptance with other statuses on same unit — only returns pending', async () => {
    const t = makeT()
    const { pendingBookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const confirmedBookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const session1Id = await seedSession(ctx, confirmedBookingId, unitId, { date: testDate(5), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, confirmedBookingId, unitId, session1Id, { status: 'Confirmed', confirmedAt: Date.now() })
      const pendingBookingId = await seedBooking(ctx, {
        ownerId: DC_SLUG,
        bookingFormComplete: false,
        activityType: ['FD'],
        startDate: testDate(8),
        endDate: testDate(8),
        divers: [
          { name: 'Eve', abbrev: 'EV', flag: { code: 'DE', label: 'Germany' }, startDate: testDate(8), endDate: testDate(8), activityType: ['FD'] },
        ],
        operatorName: 'Fun Dive DC',
      })
      const session2Id = await seedSession(ctx, pendingBookingId, unitId, { date: testDate(8), startTime: '09:00', endTime: '12:00' })
      await seedReservation(ctx, pendingBookingId, unitId, session2Id, { status: 'PendingAcceptance' })
      return { pendingBookingId }
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getOpenRequests, { activeRole: 'Instructor' })

    expect(result).toHaveLength(1)
    expect(result[0].bookingId).toBe(pendingBookingId)
    expect(result[0].activityType).toEqual(['FD'])
  })
})

describe('getConfirmedSchedule', () => {
  it('returns Confirmed reservations with booking context and sessions', async () => {
    const t = makeT()

    const { unitId, bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })

      const session1Id = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(5), startTime: '09:00', endTime: '12:00' })
      await seedReservation(ctx, bookingId, unitId, session1Id, { status: 'Confirmed', confirmedAt: 999 })
      return { unitId, bookingId }
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' })

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
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })

      const session1Id = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(5), startTime: '09:00', endTime: '12:00' })
      await seedReservation(ctx, bookingId, unitId, session1Id, { status: 'Confirmed', confirmedAt: 999 })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' })

    const dates = result[0].sessions.map((s) => s.date)
    expect(dates).toEqual([testDate(5), testDate(6)])
  })

  it('filters sessions to only those belonging to this inventory unit', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const otherUnitId = await seedInventoryUnit(ctx, { ownerId: 'other', ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'Other Instructor' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })

      const session1Id = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedSession(ctx, bookingId, otherUnitId, { date: testDate(7), startTime: '10:00', endTime: '14:00' })
      await seedReservation(ctx, bookingId, unitId, session1Id, { status: 'Confirmed', confirmedAt: 999 })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' })

    expect(result[0].sessions).toHaveLength(1)
    expect(result[0].sessions[0].date).toBe(testDate(6))
  })

  it('sorts results by earliest session date ascending', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })

      const booking1Id = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const session1Id = await seedSession(ctx, booking1Id, unitId, { date: testDate(5), startTime: '09:00', endTime: '12:00' })
      await seedReservation(ctx, booking1Id, unitId, session1Id, { status: 'Confirmed', confirmedAt: 100 })

      const booking2Id = await seedBooking(ctx, {
        ownerId: DC_SLUG,
        bookingFormComplete: false,
        status: 'Upcoming',
        startDate: testDate(3),
        endDate: testDate(4),
        divers: [{ name: 'Carol', abbrev: 'CA', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(3), endDate: testDate(4), activityType: ['OW'] }],
        operatorName: 'Test DC',
      })
      const session2Id = await seedSession(ctx, booking2Id, unitId, { date: testDate(3), startTime: '09:00', endTime: '12:00' })
      await seedReservation(ctx, booking2Id, unitId, session2Id, { status: 'Confirmed', confirmedAt: 200 })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' })

    expect(result[0].startDate).toBe(testDate(3))
    expect(result[1].startDate).toBe(testDate(5))
  })

  it('returns empty array when no confirmed reservations exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' })

    expect(result).toEqual([])
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when caller user record does not exist', async () => {
    const t = makeT()

    await expect(
      t.withIdentity({ tokenIdentifier: 'user|nobody' })
        .query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('skips reservation when booking record is missing', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: INSTRUCTOR_SLUG, tokenIdentifier: INSTRUCTOR_TOKEN, role: 'Instructor', name: 'John Doe', firstName: 'John', lastName: 'Doe' })
      const unitId = await seedInventoryUnit(ctx, { ownerId: INSTRUCTOR_SLUG, ownerType: 'Instructor', resourceType: 'Instructor', displayName: 'John Doe' })
      const bookingId = await seedBooking(ctx, { ownerId: DC_SLUG, bookingFormComplete: false, divers: DEFAULT_DIVERS, operatorName: 'Phuket Dive Center' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(6), startTime: '08:00', endTime: '16:00' })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed', confirmedAt: 999 })
      await ctx.db.delete(bookingId)
    })

    const result = await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN })
      .query(api.resourceQueries.getConfirmedSchedule, { activeRole: 'Instructor' })

    expect(result).toEqual([])
  })
})
