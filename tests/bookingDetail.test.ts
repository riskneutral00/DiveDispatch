import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { logBookingChange } from '../convex/lib/auditLog'
import { testDate, testToken } from './helpers/dates'
import type { Id } from '../convex/_generated/dataModel'
import {
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedSession,
  seedReservation,
  seedBookingResource,
  seedCustomerProfile,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'


async function seedReservationWithAutoSession(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  inventoryUnitId: Id<'inventoryUnits'>,
  status: 'PendingAcceptance' | 'Confirmed' | 'Vacated' | 'NoShow',
  bookingSessionId?: Id<'bookingSessions'>,
) {
  const sessionId =
    bookingSessionId ??
    (await seedSession(ctx, bookingId, inventoryUnitId, {
      date: testDate(5),
      startTime: '09:00',
      endTime: '17:00',
    }))
  return seedReservation(ctx, bookingId, inventoryUnitId, sessionId, { status })
}


async function seedTestUser(
  ctx: SeedCtx,
  slug: string,
  role: 'DiveCenter' | 'Instructor' | 'Boat' | 'Equipment' | 'Venue' | 'Compressor' | 'Agent' = 'DiveCenter',
  email?: string,
) {
  return seedUser(ctx, {
    slug,
    tokenIdentifier: `clerk|${slug}`,
    role,
    email: email ?? `${slug}@test.com`,
    name: `${slug} Name`,
    firstName: slug,
    lastName: 'Test',
  })
}


describe('getBookingDetail', () => {
  it('returns all stakeholder names for in-system IDs', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      await seedTestUser(ctx, 'boat-1', 'Boat')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Boat',
        resourceId: 'boat-1',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.instructorName).toBe('instructor-1 Name')
    expect(result!.boatName).toBe('boat-1 Name')

    expect(Array.isArray(result!.stakeholders)).toBe(true)
    const instructorStakeholder = result!.stakeholders.find(
      (s) => s.role === 'Instructor',
    )
    expect(instructorStakeholder).toMatchObject({
      role: 'Instructor',
      name: 'instructor-1 Name',
      isExternal: false,
      slug: 'instructor-1',
    })
    expect(instructorStakeholder!.isExternal).toBe(false)
    expect(instructorStakeholder!.slug).toBe('instructor-1')

    const boatStakeholder = result!.stakeholders.find((s) => s.role === 'Boat')
    expect(boatStakeholder).toMatchObject({
      role: 'Boat',
      name: 'boat-1 Name',
      isExternal: false,
    })
  })

  it('returns external stakeholder names with isExternal=true', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        externalName: 'External Instructor Joe',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Boat',
        externalName: 'External Boat Sally',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(Array.isArray(result!.stakeholders)).toBe(true)

    const extInstructor = result!.stakeholders.find(
      (s) => s.role === 'Instructor',
    )
    expect(extInstructor).toMatchObject({
      role: 'Instructor',
      name: 'External Instructor Joe',
      isExternal: true,
    })
    expect(extInstructor!.slug).toBeUndefined()

    const extBoat = result!.stakeholders.find((s) => s.role === 'Boat')
    expect(extBoat).toMatchObject({
      role: 'Boat',
      name: 'External Boat Sally',
      isExternal: true,
    })
  })

  it('returns all customer profiles with portal completion status', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          { name: 'A', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'B', abbrev: 'B', flag: { code: 'US', label: 'USA' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'C', abbrev: 'C', flag: { code: 'GB', label: 'UK' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
        ],
      })
      await seedCustomerProfile(ctx, bookingId, { submittedAt: Date.now() }) // submitted
      await seedCustomerProfile(ctx, bookingId) // pending
      await seedCustomerProfile(ctx, bookingId) // pending
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.customerProfiles).toHaveLength(3)
    const submitted = result!.customerProfiles.filter((p) => p.submittedAt != null)
    const pending = result!.customerProfiles.filter((p) => p.submittedAt == null)
    expect(submitted).toHaveLength(1)
    expect(pending).toHaveLength(2)
  })

  it('returns sessions with date, time, and inventory unit display name', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        resourceType: 'Instructor',
        ownerType: 'Instructor',
        displayName: 'instructor-1 Unit',
      })
      await seedSession(ctx, bookingId, iuId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '17:00',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.sessions).toHaveLength(1)
    expect(result!.sessions[0].date).toBe(testDate(5))
    expect(result!.sessions[0].startTime).toBe('09:00')
    expect(result!.sessions[0].endTime).toBe('17:00')
    expect(result!.sessions[0].inventoryUnitName).toBe('instructor-1 Unit')
  })

  it('returns reservations with status, resource name, and stakeholder name', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        resourceType: 'Instructor',
        ownerType: 'Instructor',
        displayName: 'instructor-1 Unit',
      })
      await seedReservationWithAutoSession(ctx, bookingId, iuId, 'Confirmed')
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.reservations).toHaveLength(1)
    expect(result!.reservations[0].status).toBe('Confirmed')
    expect(result!.reservations[0].inventoryUnitName).toBe('instructor-1 Unit')
    expect(result!.reservations[0].resourceType).toBe('Instructor')
    expect(result!.reservations[0].stakeholderName).toBe('instructor-1 Name')
  })

  it('returns audit log entries sorted by timestamp descending', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
    })
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .run(async (ctx) => {
        await logBookingChange(ctx, {
          bookingId,
          action: 'created',
          actorSlug: 'dc-1',
          actorType: 'operator',
        })
        await logBookingChange(ctx, {
          bookingId,
          action: 'edited',
          actorSlug: 'dc-1',
          actorType: 'operator',
          note: 'Updated dates',
        })
      })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(Array.isArray(result!.auditLog)).toBe(true)
    expect(result!.auditLog).toHaveLength(2)
    expect(result!.auditLog[0].action).toBe('edited')
    expect(result!.auditLog[1].action).toBe('created')
  })

  it('returns overview fields: status, dates, activityType, operatorName', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        status: 'Upcoming',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.status).toBe('Upcoming')
    expect(result!.startDate).toBe(testDate(5))
    expect(result!.endDate).toBe(testDate(7))
    expect(result!.activityType).toContain('OW')
    expect(result!.operatorName).toBe('Test DC')
  })

  it('stakeholders have isExternal flag distinguishing in-system vs external', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Boat',
        externalName: 'Charter Express',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    const inSystem = result!.stakeholders.filter((s) => !s.isExternal)
    const external = result!.stakeholders.filter((s) => s.isExternal)
    expect(inSystem).toHaveLength(1)
    expect(inSystem[0].slug).toBe('instructor-1')
    expect(external).toHaveLength(1)
    expect(external[0].name).toBe('Charter Express')
  })

  it('returns reservation with PendingAcceptance status', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        resourceType: 'Instructor',
        ownerType: 'Instructor',
        displayName: 'instructor-1 Unit',
      })
      await seedReservationWithAutoSession(ctx, bookingId, iuId, 'PendingAcceptance')
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.reservations[0].status).toBe('PendingAcceptance')
  })

  it('customer profiles reflect portal completion via submittedAt', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    const submittedTime = Date.now()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedCustomerProfile(ctx, bookingId, { submittedAt: submittedTime })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.customerProfiles[0].submittedAt).toBe(submittedTime)
  })

  it('auditLog field is always present (empty if no entries)', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(Array.isArray(result!.auditLog)).toBe(true)
    expect(result!.auditLog).toHaveLength(0)
  })

  it('stakeholder reservationStatus reflects their inventory unit status', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        resourceType: 'Instructor',
        ownerType: 'Instructor',
        displayName: 'instructor-1 Unit',
      })
      await seedReservationWithAutoSession(ctx, bookingId, iuId, 'Confirmed')
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    const instructorStakeholder = result!.stakeholders.find(
      (s) => s.slug === 'instructor-1',
    )
    expect(instructorStakeholder).toMatchObject({
      slug: 'instructor-1',
      reservationStatus: 'Confirmed',
    })
  })
})
