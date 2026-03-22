import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { logBookingChange } from '../convex/bookingAuditLog'
import { testDate, testToken } from './helpers/dates'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(
  ctx: Ctx,
  slug: string,
  role = 'DiveCenter',
  email?: string,
) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: email ?? `${slug}@test.com`,
    name: `${slug} Name`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedBooking(
  ctx: Ctx,
  ownerId: string,
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: 43200000,
    paid: false,
    activityType: ['OW'],
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
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(overrides as any),
  })
}

async function seedInventoryUnit(
  ctx: Ctx,
  ownerId: string,
  resourceType: string,
) {
  return ctx.db.insert('inventoryUnits', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resourceType: resourceType as any,
    resourceId: ownerId,
    displayName: `${ownerId} Unit`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownerType: resourceType as any,
  })
}

async function seedReservation(
  ctx: Ctx,
  bookingId: string,
  inventoryUnitId: string,
  status: string,
  bookingSessionId?: string,
) {
  // If no session provided, create a placeholder session
  const sessionId =
    bookingSessionId ??
    (await ctx.db.insert('bookingSessions', {
      bookingId,
      inventoryUnitId,
      date: testDate(5),
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'Asia/Bangkok',
    }))
  return ctx.db.insert('reservations', {
    bookingId,
    inventoryUnitId,
    bookingSessionId: sessionId,
    unitsRequested: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: status as any,
  })
}

async function seedSession(
  ctx: Ctx,
  bookingId: string,
  inventoryUnitId: string,
) {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId,
    date: testDate(5),
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
  })
}

async function seedCustomerProfile(
  ctx: Ctx,
  bookingId: string,
  submittedAt?: number,
) {
  return ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: testToken('token'),
    physicianClearanceRequired: false,
    ...(submittedAt !== undefined ? { submittedAt } : {}),
  })
}

// ─── getBookingDetail — enhanced query ────────────────────────────────────────

describe('getBookingDetail', () => {
  // ── test 1: returns all stakeholder names (in-system) ──────────────────────
  it('returns all stakeholder names for in-system IDs', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedUser(ctx, 'boat-1', 'Boat')
      bookingId = await seedBooking(ctx, 'dc-1')
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Instructor',
        resourceSlug: 'instructor-1',
      })
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Boat',
        resourceSlug: 'boat-1',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.instructorName).toBe('instructor-1 Name')
    expect(result!.boatName).toBe('boat-1 Name')

    // New: stakeholders array
    expect(result!.stakeholders).toBeDefined()
    const instructorStakeholder = result!.stakeholders.find(
      (s) => s.role === 'Instructor',
    )
    expect(instructorStakeholder).toBeDefined()
    expect(instructorStakeholder!.name).toBe('instructor-1 Name')
    expect(instructorStakeholder!.isExternal).toBe(false)
    expect(instructorStakeholder!.slug).toBe('instructor-1')

    const boatStakeholder = result!.stakeholders.find((s) => s.role === 'Boat')
    expect(boatStakeholder).toBeDefined()
    expect(boatStakeholder!.name).toBe('boat-1 Name')
    expect(boatStakeholder!.isExternal).toBe(false)
  })

  // ── test 2: returns external stakeholder names ─────────────────────────────
  it('returns external stakeholder names with isExternal=true', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, 'dc-1')
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Instructor',
        externalName: 'External Instructor Joe',
      })
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Boat',
        externalName: 'External Boat Sally',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.stakeholders).toBeDefined()

    const extInstructor = result!.stakeholders.find(
      (s) => s.role === 'Instructor',
    )
    expect(extInstructor).toBeDefined()
    expect(extInstructor!.name).toBe('External Instructor Joe')
    expect(extInstructor!.isExternal).toBe(true)
    expect(extInstructor!.slug).toBeUndefined()

    const extBoat = result!.stakeholders.find((s) => s.role === 'Boat')
    expect(extBoat).toBeDefined()
    expect(extBoat!.name).toBe('External Boat Sally')
    expect(extBoat!.isExternal).toBe(true)
  })

  // ── test 3: returns all customer profiles with portal completion status ─────
  it('returns all customer profiles with portal completion status', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, 'dc-1', {
        divers: [
          { name: 'A', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'B', abbrev: 'B', flag: { code: 'US', label: 'USA' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
          { name: 'C', abbrev: 'C', flag: { code: 'GB', label: 'UK' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] },
        ],
      })
      await seedCustomerProfile(ctx, bookingId, Date.now()) // submitted
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

  // ── test 4: returns sessions with inventory info ───────────────────────────
  it('returns sessions with date, time, and inventory unit display name', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, 'dc-1')
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Instructor',
        resourceSlug: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')
      await seedSession(ctx, bookingId, iuId)
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

  // ── test 5: returns reservations with status and stakeholder name ──────────
  it('returns reservations with status, resource name, and stakeholder name', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, 'dc-1')
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Instructor',
        resourceSlug: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')
      await seedReservation(ctx, bookingId, iuId, 'Confirmed')
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

  // ── test 6: returns audit log ──────────────────────────────────────────────
  it('returns audit log entries sorted by timestamp descending', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, 'dc-1')
    })
    // Insert audit entries
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
    expect(result!.auditLog).toBeDefined()
    expect(result!.auditLog.length).toBeGreaterThanOrEqual(2)
    // Sorted descending: most recent first
    expect(result!.auditLog[0].action).toBe('edited')
    expect(result!.auditLog[1].action).toBe('created')
  })

  // ── test 7: overview fields present ───────────────────────────────────────
  it('returns overview fields: status, dates, activityType, operatorName', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
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

  // ── test 8: stakeholders include isExternal flag ──────────────────────────
  it('stakeholders have isExternal flag distinguishing in-system vs external', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, 'dc-1')
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Instructor',
        resourceSlug: 'instructor-1',
      })
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
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

  // ── test 9: reservation status values ────────────────────────────────────
  it('returns reservation with PendingAcceptance status', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, 'dc-1')
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Instructor',
        resourceSlug: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')
      await seedReservation(ctx, bookingId, iuId, 'PendingAcceptance')
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.reservations[0].status).toBe('PendingAcceptance')
  })

  // ── test 10: customer portal status shown via submittedAt ─────────────────
  it('customer profiles reflect portal completion via submittedAt', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    const submittedTime = Date.now()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, 'dc-1')
      await seedCustomerProfile(ctx, bookingId, submittedTime)
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(result!.customerProfiles[0].submittedAt).toBe(submittedTime)
  })

  // ── test 11: auditLog array present ──────────────────────────────────────
  it('auditLog field is always present (empty if no entries)', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      bookingId = await seedBooking(ctx, 'dc-1')
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    expect(Array.isArray(result!.auditLog)).toBe(true)
    expect(result!.auditLog).toHaveLength(0)
  })

  // ── test 12: stakeholder reservation status propagated ────────────────────
  it('stakeholder reservationStatus reflects their inventory unit status', async () => {
    const t = convexTest(schema, modules)
    let bookingId: string
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      bookingId = await seedBooking(ctx, 'dc-1')
      await ctx.db.insert('bookingResources', {
        bookingId: bookingId as any,
        resourceType: 'Instructor',
        resourceSlug: 'instructor-1',
      })
      const iuId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')
      await seedReservation(ctx, bookingId, iuId, 'Confirmed')
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.getBookingDetail, { bookingId: bookingId! as never })

    expect(result).not.toBeNull()
    const instructorStakeholder = result!.stakeholders.find(
      (s) => s.slug === 'instructor-1',
    )
    expect(instructorStakeholder).toBeDefined()
    expect(instructorStakeholder!.reservationStatus).toBe('Confirmed')
  })
})
