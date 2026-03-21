import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { buildInstructorNameMap } from '../convex/bookings'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role = 'DiveCenter') {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

// Resource fields that should go to bookingResources, not the booking doc
const RESOURCE_FIELD_MAP: Record<string, string> = {
  instructorId: 'Instructor',
  boatId: 'Boat',
  equipmentManagerId: 'Equipment',
  poolId: 'Pool',
  compressorId: 'Compressor',
}
const EXT_FIELD_MAP: Record<string, string> = {
  instructorName: 'Instructor',
  boatName: 'Boat',
  equipmentManagerName: 'Equipment',
  poolName: 'Pool',
  compressorName: 'Compressor',
}

async function seedBooking(ctx: Ctx, ownerId: string, overrides: Record<string, unknown> = {}) {
  // Separate resource fields from booking fields
  const bookingOverrides = { ...overrides }
  const resourceEntries: { type: string; slug?: string; ext?: string }[] = []

  for (const [field, resourceType] of Object.entries(RESOURCE_FIELD_MAP)) {
    const slug = bookingOverrides[field] as string | undefined
    if (slug) {
      resourceEntries.push({ type: resourceType, slug })
      delete bookingOverrides[field]
    }
  }
  const ext = bookingOverrides.externalStakeholders as Record<string, string> | undefined
  if (ext) {
    for (const [field, resourceType] of Object.entries(EXT_FIELD_MAP)) {
      if (ext[field]) resourceEntries.push({ type: resourceType, ext: ext[field] })
    }
    delete bookingOverrides.externalStakeholders
  }

  const bookingId = await ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: 43200000,
    paid: false,
    activityType: ['OW'],
    startDate: '2025-06-15',
    endDate: '2025-06-17',
    divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: '2025-06-15', endDate: '2025-06-17', activityType: ['OW'] }],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(bookingOverrides as any),
  })

  // Insert bookingResources rows
  for (const entry of resourceEntries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.db.insert('bookingResources', {
      bookingId,
      resourceType: entry.type as any,
      ...(entry.slug ? { resourceSlug: entry.slug } : {}),
      ...(entry.ext ? { externalName: entry.ext } : {}),
    } as any)
  }

  return bookingId
}

async function seedInventoryUnit(ctx: Ctx, ownerId: string, ownerType = 'Instructor') {
  return ctx.db.insert('inventoryUnits', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resourceType: ownerType as any,
    resourceId: ownerId,
    displayName: `${ownerId} unit`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownerType: ownerType as any,
  })
}

// ─── buildInstructorNameMap ───────────────────────────────────────────────────

describe('buildInstructorNameMap', () => {
  it('returns empty map for empty slug list', async () => {
    const t = convexTest(schema, modules)
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, [])
      return Object.fromEntries(map)
    })
    expect(Object.keys(entries)).toHaveLength(0)
  })

  it('resolves known slugs to display names', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'instructor-1', 'Instructor'))
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['instructor-1'])
      return Object.fromEntries(map)
    })
    expect(entries['instructor-1']).toBe('instructor-1 Display')
  })

  it('deduplicates slugs before querying', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'instructor-1', 'Instructor'))
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['instructor-1', 'instructor-1', 'instructor-1'])
      return Object.fromEntries(map)
    })
    expect(Object.keys(entries)).toHaveLength(1)
    expect(entries['instructor-1']).toBe('instructor-1 Display')
  })

  it('skips unknown slugs without error', async () => {
    const t = convexTest(schema, modules)
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['unknown-slug'])
      return Object.fromEntries(map)
    })
    expect(Object.keys(entries)).toHaveLength(0)
  })

  it('resolves multiple slugs', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedUser(ctx, 'boat-owner-1', 'Boat')
    })
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['instructor-1', 'boat-owner-1'])
      return Object.fromEntries(map)
    })
    expect(entries['instructor-1']).toBe('instructor-1 Display')
    expect(entries['boat-owner-1']).toBe('boat-owner-1 Display')
  })
})

// ─── listByOwner ──────────────────────────────────────────────────────────────

describe('listByOwner', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
        .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('throws FORBIDDEN when caller slug does not match ownerId', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'dc-2'))

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-2' })
        .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  it('returns empty array when owner has no bookings', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'dc-1'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toEqual([])
  })

  it('returns CalendarBooking shape with correct fields', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      activityType: ['OW'],
      startDate: '2025-06-15',
      endDate: '2025-06-17',
      status: 'Upcoming',
      diverCount: 1,
    })
    expect(result[0]._id).toBeDefined()
  })

  it('scopes by ownerType — excludes mismatched ownerType', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', { ownerType: 'Agent' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toHaveLength(0)
  })

  it('denormalizes instructorName from name map', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedBooking(ctx, 'dc-1', { instructorId: 'instructor-1', status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result[0].instructorName).toBe('instructor-1 Display')
  })

  it('falls back to externalStakeholders when no in-system instructor', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', {
        externalStakeholders: { instructorName: 'External Joe' },
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result[0].instructorName).toBe('External Joe')
  })

  it('sets customerName from first diver', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', {
        divers: [
          { name: 'Bob', abbrev: 'B', flag: { code: 'US', label: 'USA' }, startDate: '2025-06-15', endDate: '2025-06-15', activityType: ['OW'] },
          { name: 'Carol', abbrev: 'C', flag: { code: 'UK', label: 'UK' }, startDate: '2025-06-15', endDate: '2025-06-15', activityType: ['OW'] },
        ],
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result[0].customerName).toBe('Bob')
    expect(result[0].diverCount).toBe(2)
  })

  it('returns multiple bookings for the same owner, excludes other owners', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', { status: 'Draft' })
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
      await seedBooking(ctx, 'dc-2', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toHaveLength(2)
  })
})

// ─── listByStatus ─────────────────────────────────────────────────────────────

describe('listByStatus', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.bookings.listByStatus, { status: 'Draft' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
        .query(api.bookings.listByStatus, { status: 'Draft' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('returns empty array when no bookings match status', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { status: 'Draft' })

    expect(result).toHaveLength(0)
  })

  it('returns only caller bookings with matching status', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', { status: 'Draft' })
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { status: 'Draft' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Draft')
  })

  it('does not return other owners bookings with same status', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
      await seedBooking(ctx, 'dc-2', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { status: 'Upcoming' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Upcoming')
  })

  it('works for resource role — uses by_instructorId index', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
      await seedBooking(ctx, 'dc-2', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.listByStatus, { status: 'Upcoming' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Upcoming')
  })

  it('returns all statuses correctly — Completed', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1')
      await seedBooking(ctx, 'dc-1', { status: 'Completed' })
      await seedBooking(ctx, 'dc-1', { status: 'Cancelled' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { status: 'Completed' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Completed')
  })
})

// ─── listByResource ───────────────────────────────────────────────────────────

describe('listByResource', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
        .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('throws FORBIDDEN when caller slug does not match resourceId', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'instructor-2', 'Instructor'))

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|instructor-2' })
        .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  it('returns empty array when no bookings assigned to resource', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'instructor-1', 'Instructor'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' })

    expect(result).toHaveLength(0)
  })

  it('returns bookings where instructor is assigned', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
      await seedBooking(ctx, 'dc-1', { status: 'Draft', instructorId: 'instructor-1' })
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' })

    expect(result).toHaveLength(2)
  })

  it('works for Boat resource type', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'boat-owner-1', 'Boat')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming', boatId: 'boat-owner-1' })
      await seedBooking(ctx, 'dc-1', { status: 'Draft', boatId: 'boat-owner-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|boat-owner-1' })
      .query(api.bookings.listByResource, { resourceId: 'boat-owner-1', resourceType: 'Boat' })

    expect(result).toHaveLength(2)
  })

  it('works for Equipment resource type', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'em-1', 'Equipment')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming', equipmentManagerId: 'em-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|em-1' })
      .query(api.bookings.listByResource, { resourceId: 'em-1', resourceType: 'Equipment' })

    expect(result).toHaveLength(1)
  })

  it('works for Pool resource type', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'pool-1', 'Pool')
      await seedBooking(ctx, 'dc-1', { status: 'Draft', poolId: 'pool-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|pool-1' })
      .query(api.bookings.listByResource, { resourceId: 'pool-1', resourceType: 'Pool' })

    expect(result).toHaveLength(1)
  })

  it('works for Compressor resource type', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'comp-1', 'Compressor')
      await seedBooking(ctx, 'dc-1', { status: 'Draft', compressorId: 'comp-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|comp-1' })
      .query(api.bookings.listByResource, { resourceId: 'comp-1', resourceType: 'Compressor' })

    expect(result).toHaveLength(1)
  })

  it('denormalizes boatName from name map', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'boat-owner-1', 'Boat')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming', boatId: 'boat-owner-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|boat-owner-1' })
      .query(api.bookings.listByResource, { resourceId: 'boat-owner-1', resourceType: 'Boat' })

    expect(result[0].boatName).toBe('boat-owner-1 Display')
  })
})

// ─── myDashboard ──────────────────────────────────────────────────────────────

describe('myDashboard', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.bookings.myDashboard),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
        .query(api.bookings.myDashboard),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('returns empty dashboard for operator with no bookings', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'dc-1', 'DiveCenter'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard)

    expect(result).toEqual({ bookings: [], requests: [] })
  })

  it('operator role: returns Draft, Upcoming, and Completed in bookings (excludes Cancelled)', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-1', 'DiveCenter')
      await seedBooking(ctx, 'dc-1', { status: 'Draft' })
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming' })
      await seedBooking(ctx, 'dc-1', { status: 'Completed' })
      await seedBooking(ctx, 'dc-1', { status: 'Cancelled' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard)

    expect(result.bookings).toHaveLength(3)
    const statuses = result.bookings.map((b) => b.status)
    expect(statuses).toContain('Draft')
    expect(statuses).toContain('Upcoming')
    expect(statuses).toContain('Completed')
    expect(statuses).not.toContain('Cancelled')
  })

  it('operator role: returns empty requests array', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'dc-1', 'DiveCenter'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard)

    expect(result.requests).toEqual([])
  })

  it('resource role: returns calendar bookings from confirmed assignments', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
      await seedBooking(ctx, 'dc-1', { status: 'Completed', instructorId: 'instructor-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard)

    expect(result.bookings).toHaveLength(2)
  })

  it('resource role: returns pending reservations as requests', async () => {
    const t = convexTest(schema, modules)

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')

      const bookingId = await seedBooking(ctx, 'dc-1', {
        status: 'Draft',
        operatorName: 'Ocean DC',
        activityType: ['OW', 'AOW'],
      })

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-07-10',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-07-11',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })

      return { bookingId, unitId }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard)

    expect(result.requests).toHaveLength(1)
    const req = result.requests[0]
    expect(req.bookingId).toBe(bookingId)
    expect(req.activityType).toEqual(['OW', 'AOW'])
    expect(req.dates).toEqual(['2025-07-10', '2025-07-11'])
    expect(req.status).toBe('PendingAcceptance')
    expect(req.ownerName).toBe('Ocean DC')
    expect(req._id).toBeDefined()
  })

  it('resource role: deduplicates dates across multiple sessions on same day', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')

      const bookingId = await seedBooking(ctx, 'dc-1', {
        status: 'Draft',
        operatorName: 'Ocean DC',
      })

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-07-10',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      // Second session same day
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-07-10',
        startTime: '14:00',
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
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard)

    expect(result.requests[0].dates).toEqual(['2025-07-10'])
  })

  it('resource role: skips requests for non-existent bookings', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')

      // Create a booking, get its id, then delete it
      const bookingId = await seedBooking(ctx, 'dc-1', { status: 'Draft' })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-07-10',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      // Now delete the booking to simulate orphaned reservation
      await ctx.db.delete(bookingId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard)

    expect(result.requests).toHaveLength(0)
  })

  it('resource role: only surfaces PendingAcceptance reservations (not Confirmed)', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, 'instructor-1', 'Instructor')
      const bookingId = await seedBooking(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-07-10',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      // Confirmed reservation — should NOT appear in requests
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard)

    expect(result.bookings).toHaveLength(1)
    expect(result.requests).toHaveLength(0)
  })

  it('DiveMaster role: uses by_instructorId index same as Instructor', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dm-1', 'DiveMaster')
      await seedInventoryUnit(ctx, 'dm-1', 'Instructor')
      await seedBooking(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'dm-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dm-1' })
      .query(api.bookings.myDashboard)

    expect(result.bookings).toHaveLength(1)
  })
})
