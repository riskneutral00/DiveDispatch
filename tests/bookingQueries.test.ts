import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { buildInstructorNameMap } from '../convex/bookings'
import { testDate } from './helpers/dates'
import type { Doc, Id } from '../convex/_generated/dataModel'
import {
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedBookingResource,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'


async function seedTestUser(
  ctx: SeedCtx,
  slug: string,
  role: Doc<'userRoles'>['role'] = 'DiveCenter',
) {
  return seedUser(ctx, {
    slug,
    tokenIdentifier: `clerk|${slug}`,
    role,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
  })
}


const RESOURCE_FIELD_MAP: Record<string, Doc<'bookingResources'>['resourceType']> = {
  instructorId: 'Instructor',
  boatId: 'Boat',
  equipmentManagerId: 'Equipment',
  poolId: 'Pool',
  compressorId: 'Compressor',
}
const EXT_FIELD_MAP: Record<string, Doc<'bookingResources'>['resourceType']> = {
  instructorName: 'Instructor',
  boatName: 'Boat',
  equipmentManagerName: 'Equipment',
  poolName: 'Pool',
  compressorName: 'Compressor',
}

async function seedBookingWithResources(
  ctx: SeedCtx,
  ownerId: string,
  overrides: Record<string, unknown> = {},
) {
  const bookingOverrides = { ...overrides }
  const resourceEntries: { type: Doc<'bookingResources'>['resourceType']; slug?: string; ext?: string }[] = []

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

  const bookingId = await seedBooking(ctx, {
    ownerId,
    bookingFormComplete: false,
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] }],
    ...bookingOverrides as {
      status?: Doc<'bookings'>['status']
      ownerType?: Doc<'bookings'>['ownerType']
      operatorName?: string
      activityType?: Doc<'bookings'>['activityType']
      divers?: Doc<'bookings'>['divers']
    },
  })

  for (const entry of resourceEntries) {
    await seedBookingResource(ctx, bookingId, {
      resourceType: entry.type,
      ...(entry.slug ? { resourceId: entry.slug } : {}),
      ...(entry.ext ? { externalName: entry.ext } : {}),
    })
  }

  return bookingId
}


describe('buildInstructorNameMap', () => {
  it('returns empty map for empty slug list', async () => {
    const t = makeT()
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, [])
      return Object.fromEntries(map)
    })
    expect(Object.keys(entries)).toHaveLength(0)
  })

  it('resolves known slugs to display names', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'instructor-1', 'Instructor'))
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['instructor-1'])
      return Object.fromEntries(map)
    })
    expect(entries['instructor-1']).toBe('instructor-1 Display')
  })

  it('deduplicates slugs before querying', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'instructor-1', 'Instructor'))
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['instructor-1', 'instructor-1', 'instructor-1'])
      return Object.fromEntries(map)
    })
    expect(Object.keys(entries)).toHaveLength(1)
    expect(entries['instructor-1']).toBe('instructor-1 Display')
  })

  it('skips unknown slugs without error', async () => {
    const t = makeT()
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['unknown-slug'])
      return Object.fromEntries(map)
    })
    expect(Object.keys(entries)).toHaveLength(0)
  })

  it('resolves multiple slugs', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      await seedTestUser(ctx, 'boat-owner-1', 'Boat')
    })
    const entries = await t.run(async (ctx) => {
      const map = await buildInstructorNameMap(ctx, ['instructor-1', 'boat-owner-1'])
      return Object.fromEntries(map)
    })
    expect(entries['instructor-1']).toBe('instructor-1 Display')
    expect(entries['boat-owner-1']).toBe('boat-owner-1 Display')
  })
})


describe('listByOwner', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = makeT()

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
        .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('throws FORBIDDEN when caller slug does not match ownerId', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'dc-2'))

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-2' })
        .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  it('returns empty array when owner has no bookings', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'dc-1'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toEqual([])
  })

  it('returns CalendarBooking shape with correct fields', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      activityType: ['OW'],
      startDate: testDate(5),
      endDate: testDate(7),
      status: 'Upcoming',
      diverCount: 1,
    })
    expect(typeof result[0]._id).toBe('string')
  })

  it('scopes by ownerType — excludes mismatched ownerType', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', { ownerType: 'Agent' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toHaveLength(0)
  })

  it('denormalizes instructorName from name map', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      await seedBookingWithResources(ctx, 'dc-1', { instructorId: 'instructor-1', status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result[0].instructorName).toBe('instructor-1 Display')
  })

  it('falls back to externalStakeholders when no in-system instructor', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', {
        externalStakeholders: { instructorName: 'External Joe' },
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result[0].instructorName).toBe('External Joe')
  })

  it('sets customerName from first diver', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', {
        divers: [
          { name: 'Bob', abbrev: 'B', flag: { code: 'US', label: 'USA' }, startDate: testDate(5), endDate: testDate(5), activityType: ['OW'] },
          { name: 'Carol', abbrev: 'C', flag: { code: 'UK', label: 'UK' }, startDate: testDate(5), endDate: testDate(5), activityType: ['OW'] },
        ],
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result[0].customerName).toBe('Bob')
    expect(result[0].diverCount).toBe(2)
  })

  it('returns multiple bookings for the same owner, excludes other owners', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming' })
      await seedBookingWithResources(ctx, 'dc-2', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })

    expect(result).toHaveLength(2)
  })
})


describe('listByStatus', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.query(api.bookings.listByStatus, { activeRole: 'DiveCenter', status: 'Draft' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = makeT()

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
        .query(api.bookings.listByStatus, { activeRole: 'DiveCenter', status: 'Draft' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('returns empty array when no bookings match status', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { activeRole: 'DiveCenter', status: 'Draft' })

    expect(result).toHaveLength(0)
  })

  it('returns only caller bookings with matching status', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { activeRole: 'DiveCenter', status: 'Draft' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Draft')
  })

  it('does not return other owners bookings with same status', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming' })
      await seedBookingWithResources(ctx, 'dc-2', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { activeRole: 'DiveCenter', status: 'Upcoming' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Upcoming')
  })

  it('works for resource role — uses by_instructorId index', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
      await seedBookingWithResources(ctx, 'dc-2', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.listByStatus, { activeRole: 'Instructor', status: 'Upcoming' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Upcoming')
  })

  it('returns all statuses correctly — Completed', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Completed' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Cancelled' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByStatus, { activeRole: 'DiveCenter', status: 'Completed' })

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Completed')
  })
})


describe('listByResource', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = makeT()

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
        .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('throws FORBIDDEN when caller slug does not match resourceId', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'instructor-2', 'Instructor'))

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|instructor-2' })
        .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  it('returns empty array when no bookings assigned to resource', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'instructor-1', 'Instructor'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' })

    expect(result).toHaveLength(0)
  })

  it('returns bookings where instructor is assigned', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft', instructorId: 'instructor-1' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.listByResource, { resourceId: 'instructor-1', resourceType: 'Instructor' })

    expect(result).toHaveLength(2)
  })

  it('works for Boat resource type', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'boat-owner-1', 'Boat')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', boatId: 'boat-owner-1' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft', boatId: 'boat-owner-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|boat-owner-1' })
      .query(api.bookings.listByResource, { resourceId: 'boat-owner-1', resourceType: 'Boat' })

    expect(result).toHaveLength(2)
  })

  it('works for Equipment resource type', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'em-1', 'Equipment')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', equipmentManagerId: 'em-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|em-1' })
      .query(api.bookings.listByResource, { resourceId: 'em-1', resourceType: 'Equipment' })

    expect(result).toHaveLength(1)
  })

  it('works for Pool resource type', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'pool-1', 'Pool')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft', poolId: 'pool-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|pool-1' })
      .query(api.bookings.listByResource, { resourceId: 'pool-1', resourceType: 'Pool' })

    expect(result).toHaveLength(1)
  })

  it('works for Compressor resource type', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'comp-1', 'Compressor')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft', compressorId: 'comp-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|comp-1' })
      .query(api.bookings.listByResource, { resourceId: 'comp-1', resourceType: 'Compressor' })

    expect(result).toHaveLength(1)
  })

  it('denormalizes boatName from name map', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'boat-owner-1', 'Boat')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', boatId: 'boat-owner-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|boat-owner-1' })
      .query(api.bookings.listByResource, { resourceId: 'boat-owner-1', resourceType: 'Boat' })

    expect(result[0].boatName).toBe('boat-owner-1 Display')
  })
})


describe('myDashboard', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.query(api.bookings.myDashboard, { activeRole: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const t = makeT()

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
        .query(api.bookings.myDashboard, { activeRole: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('returns empty dashboard for operator with no bookings', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'dc-1', 'DiveCenter'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard, { activeRole: 'DiveCenter' })

    expect(result).toEqual({ bookings: [], requests: [] })
  })

  it('operator role: returns Draft, Upcoming, and Completed in bookings (excludes Cancelled)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-1', 'DiveCenter')
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Completed' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Cancelled' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard, { activeRole: 'DiveCenter' })

    expect(result.bookings).toHaveLength(3)
    const statuses = result.bookings.map((b) => b.status)
    expect(statuses).toContain('Draft')
    expect(statuses).toContain('Upcoming')
    expect(statuses).toContain('Completed')
    expect(statuses).not.toContain('Cancelled')
  })

  it('operator role: returns empty requests array', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedTestUser(ctx, 'dc-1', 'DiveCenter'))

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard, { activeRole: 'DiveCenter' })

    expect(result.requests).toEqual([])
  })

  it('resource role: returns calendar bookings from confirmed assignments', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      await seedInventoryUnit(ctx, { ownerId: 'instructor-1', resourceType: 'Instructor', ownerType: 'Instructor', displayName: 'instructor-1 unit' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Completed', instructorId: 'instructor-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.bookings).toHaveLength(2)
  })

  it('resource role: returns pending reservations as requests', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, { ownerId: 'instructor-1', resourceType: 'Instructor', ownerType: 'Instructor', displayName: 'instructor-1 unit' })

      const bookingId = await seedBookingWithResources(ctx, 'dc-1', {
        status: 'Draft',
        operatorName: 'Ocean DC',
        activityType: ['OW', 'AOW'],
      })

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(10),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(12),
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
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.requests).toHaveLength(1)
    const req = result.requests[0]
    expect(req.bookingId).toBe(bookingId)
    expect(req.activityType).toEqual(['OW', 'AOW'])
    expect(req.dates).toEqual([testDate(10), testDate(12)])
    expect(req.status).toBe('PendingAcceptance')
    expect(req.ownerName).toBe('Ocean DC')
    expect(typeof req._id).toBe('string')
  })

  it('resource role: deduplicates dates across multiple sessions on same day', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, { ownerId: 'instructor-1', resourceType: 'Instructor', ownerType: 'Instructor', displayName: 'instructor-1 unit' })

      const bookingId = await seedBookingWithResources(ctx, 'dc-1', {
        status: 'Draft',
        operatorName: 'Ocean DC',
      })

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(10),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(10),
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
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.requests[0].dates).toEqual([testDate(10)])
  })

  it('resource role: reservationStatus on each calendar row when one unit serves many bookings', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        resourceType: 'Instructor',
        ownerType: 'Instructor',
        displayName: 'instructor-1 unit',
      })

      const bookingIds = await Promise.all([
        seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' }),
        seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' }),
        seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' }),
      ])

      for (const bookingId of bookingIds) {
        const sessionId = await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date: testDate(10),
          startTime: '09:00',
          endTime: '11:00',
          timezone: 'Asia/Bangkok',
        })
        await ctx.db.insert('reservations', {
          bookingId,
          inventoryUnitId: unitId,
          bookingSessionId: sessionId,
          unitsRequested: 1,
          status: 'Confirmed',
        })
      }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.bookings).toHaveLength(3)
    for (const b of result.bookings) {
      expect(b.reservationStatus).toBe('Confirmed')
    }
  })

  it('resource role: two pending reservations on same booking yield two requests with shared session dates', async () => {
    const t = makeT()
    const { bookingId } = await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        resourceType: 'Instructor',
        ownerType: 'Instructor',
        displayName: 'instructor-1 unit',
      })

      const bookingId = await seedBookingWithResources(ctx, 'dc-1', {
        status: 'Draft',
        operatorName: 'Ocean DC',
      })

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(10),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })
      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(11),
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
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: session2Id,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })

      return { bookingId }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.requests).toHaveLength(2)
    expect(result.requests[0].bookingId).toBe(bookingId)
    expect(result.requests[1].bookingId).toBe(bookingId)
    const expectedDates = [testDate(10), testDate(11)]
    expect(result.requests[0].dates).toEqual(expectedDates)
    expect(result.requests[1].dates).toEqual(expectedDates)
  })

  it('resource role: skips requests for non-existent bookings', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, { ownerId: 'instructor-1', resourceType: 'Instructor', ownerType: 'Instructor', displayName: 'instructor-1 unit' })

      const bookingId = await seedBookingWithResources(ctx, 'dc-1', { status: 'Draft' })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(10),
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
      await ctx.db.delete(bookingId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.requests).toHaveLength(0)
  })

  it('resource role: only surfaces PendingAcceptance reservations (not Confirmed)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'instructor-1', 'Instructor')
      const unitId = await seedInventoryUnit(ctx, { ownerId: 'instructor-1', resourceType: 'Instructor', ownerType: 'Instructor', displayName: 'instructor-1 unit' })
      const bookingId = await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(10),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.bookings).toHaveLength(1)
    expect(result.requests).toHaveLength(0)
  })

  it('Instructor role with DM credential: uses by_instructorId index', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dm-1', 'Instructor')
      await seedInventoryUnit(ctx, { ownerId: 'dm-1', resourceType: 'Instructor', ownerType: 'Instructor', displayName: 'dm-1 unit' })
      await seedBookingWithResources(ctx, 'dc-1', { status: 'Upcoming', instructorId: 'dm-1' })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dm-1' })
      .query(api.bookings.myDashboard, { activeRole: 'Instructor' })

    expect(result.bookings).toHaveLength(1)
  })
})


describe('listByStatus — activeRole validation', () => {
  it('rejects with ROLE_NOT_HELD when caller claims a role they do not hold', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-role-gate')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-role-gate' })
        .query(api.bookings.listByStatus, { activeRole: 'Agent', status: 'Draft' }),
    ).rejects.toThrow(/ROLE_NOT_HELD/)
  })
})

describe('myDashboard — activeRole validation', () => {
  it('rejects with ROLE_NOT_HELD when caller claims a role they do not hold', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedTestUser(ctx, 'dc-dash-gate')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-dash-gate' })
        .query(api.bookings.myDashboard, { activeRole: 'Instructor' }),
    ).rejects.toThrow(/ROLE_NOT_HELD/)
  })
})
