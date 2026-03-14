// Mock the Convex generated server module before any imports.
import { vi } from 'vitest'

vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
}))

import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildInstructorNameMap,
  _listByOwner,
  _listByStatus,
  _listByResource,
  _myDashboard,
} from '../convex/bookings'

// ─── In-memory mock database ──────────────────────────────────────────────────

class MockIndexBuilder {
  readonly predicates: Array<(r: Record<string, unknown>) => boolean> = []

  eq(field: string, value: unknown): this {
    this.predicates.push((r) => r[field] === value)
    return this
  }
}

class MockQueryBuilder {
  private predicates: Array<(r: Record<string, unknown>) => boolean> = []

  constructor(private readonly records: Array<Record<string, unknown>>) {}

  withIndex(
    _name: string,
    build: (q: MockIndexBuilder) => MockIndexBuilder,
  ): this {
    const b = new MockIndexBuilder()
    build(b)
    this.predicates.push(...b.predicates)
    return this
  }

  async unique(): Promise<Record<string, unknown> | null> {
    const matches = this.records.filter((r) => this.predicates.every((p) => p(r)))
    return matches[0] ?? null
  }

  async collect(): Promise<Array<Record<string, unknown>>> {
    return this.records.filter((r) => this.predicates.every((p) => p(r)))
  }
}

class MockDb {
  private readonly store: Map<string, Map<string, Record<string, unknown>>> = new Map()
  private counter = 0

  private table(name: string): Map<string, Record<string, unknown>> {
    if (!this.store.has(name)) this.store.set(name, new Map())
    return this.store.get(name)!
  }

  seed(tableName: string, data: Record<string, unknown>): string {
    const id = `${tableName}:${++this.counter}`
    this.table(tableName).set(id, { ...data, _id: id })
    return id
  }

  async get(id: string): Promise<Record<string, unknown> | null> {
    for (const t of this.store.values()) {
      if (t.has(id)) return t.get(id)!
    }
    return null
  }

  async insert(tableName: string, data: Record<string, unknown>): Promise<string> {
    const id = `${tableName}:${++this.counter}`
    this.table(tableName).set(id, { ...data, _id: id })
    return id
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<void> {
    for (const t of this.store.values()) {
      if (t.has(id)) {
        t.set(id, { ...t.get(id)!, ...fields })
        return
      }
    }
  }

  async delete(id: string): Promise<void> {
    for (const t of this.store.values()) {
      t.delete(id)
    }
  }

  query(tableName: string): MockQueryBuilder {
    const records = Array.from(this.table(tableName).values())
    return new MockQueryBuilder(records)
  }

  all(tableName: string): Array<Record<string, unknown>> {
    return Array.from(this.table(tableName).values())
  }
}

function makeCtx(db: MockDb, tokenIdentifier: string | null) {
  return {
    auth: {
      getUserIdentity: async () => (tokenIdentifier ? { tokenIdentifier } : null),
    },
    db,
  }
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function seedUser(
  db: MockDb,
  slug: string,
  role = 'DiveCenter',
  overrides: Record<string, unknown> = {},
): string {
  return db.seed('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    role,
    isSeeded: false,
    preferredLocale: 'en',
    ...overrides,
  })
}

function seedBooking(
  db: MockDb,
  ownerId: string,
  overrides: Record<string, unknown> = {},
): string {
  return db.seed('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: 43_200_000,
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
    ...overrides,
  })
}

function seedInventoryUnit(
  db: MockDb,
  ownerId: string,
  ownerType = 'Instructor',
): string {
  return db.seed('inventoryUnits', {
    resourceType: ownerType,
    resourceId: ownerId,
    displayName: `${ownerId} unit`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType,
  })
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ data: { code } })
}

// ─── buildInstructorNameMap ───────────────────────────────────────────────────

describe('buildInstructorNameMap', () => {
  let db: MockDb

  beforeEach(() => {
    db = new MockDb()
  })

  it('returns empty map for empty slug list', async () => {
    const ctx = makeCtx(db, null)
    const map = await buildInstructorNameMap(ctx, [])
    expect(map.size).toBe(0)
  })

  it('resolves known slugs to display names', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    const ctx = makeCtx(db, 'clerk|dc-1')
    const map = await buildInstructorNameMap(ctx, ['instructor-1'])
    expect(map.get('instructor-1')).toBe('instructor-1 Display')
  })

  it('deduplicates slugs before querying', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    const ctx = makeCtx(db, 'clerk|dc-1')
    const map = await buildInstructorNameMap(ctx, ['instructor-1', 'instructor-1', 'instructor-1'])
    expect(map.size).toBe(1)
    expect(map.get('instructor-1')).toBe('instructor-1 Display')
  })

  it('skips unknown slugs without error', async () => {
    const ctx = makeCtx(db, 'clerk|dc-1')
    const map = await buildInstructorNameMap(ctx, ['unknown-slug'])
    expect(map.size).toBe(0)
  })

  it('resolves multiple slugs', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    seedUser(db, 'boat-owner-1', 'Boat')
    const ctx = makeCtx(db, 'clerk|dc-1')
    const map = await buildInstructorNameMap(ctx, ['instructor-1', 'boat-owner-1'])
    expect(map.get('instructor-1')).toBe('instructor-1 Display')
    expect(map.get('boat-owner-1')).toBe('boat-owner-1 Display')
  })
})

// ─── _listByOwner ─────────────────────────────────────────────────────────────

describe('_listByOwner', () => {
  let db: MockDb

  beforeEach(() => {
    db = new MockDb()
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx(db, null)
    await expectConvexError(_listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' }), 'UNAUTHENTICATED')
  })

  it('throws USER_NOT_PROVISIONED when user does not exist', async () => {
    const ctx = makeCtx(db, 'clerk|dc-1')
    await expectConvexError(_listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' }), 'USER_NOT_PROVISIONED')
  })

  it('throws FORBIDDEN when caller slug does not match ownerId', async () => {
    seedUser(db, 'dc-2')
    const ctx = makeCtx(db, 'clerk|dc-2')
    await expectConvexError(_listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' }), 'FORBIDDEN')
  })

  it('returns empty array when owner has no bookings', async () => {
    seedUser(db, 'dc-1')
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(result).toEqual([])
  })

  it('returns CalendarBooking shape with correct fields', async () => {
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', { status: 'Upcoming' })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
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
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', { ownerType: 'Agent' })
    const ctx = makeCtx(db, 'clerk|dc-1')
    // ownerType filter is DiveCenter but booking is Agent
    const result = await _listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(result).toHaveLength(0)
  })

  it('denormalizes instructorName from name map', async () => {
    seedUser(db, 'dc-1')
    seedUser(db, 'instructor-1', 'Instructor')
    seedBooking(db, 'dc-1', { instructorId: 'instructor-1', status: 'Upcoming' })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(result[0].instructorName).toBe('instructor-1 Display')
  })

  it('falls back to externalStakeholders when no in-system instructor', async () => {
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', {
      externalStakeholders: { instructorName: 'External Joe' },
    })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(result[0].instructorName).toBe('External Joe')
  })

  it('sets customerName from first diver', async () => {
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', {
      divers: [
        { name: 'Bob', abbrev: 'B', flag: { code: 'US', label: 'USA' }, startDate: '2025-06-15', endDate: '2025-06-15', activityType: ['OW'] },
        { name: 'Carol', abbrev: 'C', flag: { code: 'UK', label: 'UK' }, startDate: '2025-06-15', endDate: '2025-06-15', activityType: ['OW'] },
      ],
    })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(result[0].customerName).toBe('Bob')
    expect(result[0].diverCount).toBe(2)
  })

  it('returns multiple bookings for the same owner', async () => {
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', { status: 'Draft' })
    seedBooking(db, 'dc-1', { status: 'Upcoming' })
    seedBooking(db, 'dc-2', { status: 'Upcoming' }) // different owner, should not appear
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByOwner(ctx, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(result).toHaveLength(2)
  })
})

// ─── _listByStatus ────────────────────────────────────────────────────────────

describe('_listByStatus', () => {
  let db: MockDb

  beforeEach(() => {
    db = new MockDb()
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx(db, null)
    await expectConvexError(_listByStatus(ctx, { status: 'Draft' }), 'UNAUTHENTICATED')
  })

  it('throws USER_NOT_PROVISIONED when user does not exist', async () => {
    const ctx = makeCtx(db, 'clerk|dc-1')
    await expectConvexError(_listByStatus(ctx, { status: 'Draft' }), 'USER_NOT_PROVISIONED')
  })

  it('returns empty array when no bookings match status', async () => {
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', { status: 'Upcoming' })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByStatus(ctx, { status: 'Draft' })
    expect(result).toHaveLength(0)
  })

  it('returns only caller bookings with matching status', async () => {
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', { status: 'Draft' })
    seedBooking(db, 'dc-1', { status: 'Upcoming' })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByStatus(ctx, { status: 'Draft' })
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Draft')
  })

  it('does not return other owners bookings with same status', async () => {
    seedUser(db, 'dc-1')
    seedUser(db, 'dc-2')
    seedBooking(db, 'dc-1', { status: 'Upcoming' })
    seedBooking(db, 'dc-2', { status: 'Upcoming' }) // different owner
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByStatus(ctx, { status: 'Upcoming' })
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Upcoming')
  })

  it('works for resource role — uses instructorId index', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    // Booking where instructor is assigned
    seedBooking(db, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
    // Booking where instructor is NOT assigned (should not appear)
    seedBooking(db, 'dc-2', { status: 'Upcoming' })
    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _listByStatus(ctx, { status: 'Upcoming' })
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Upcoming')
  })

  it('returns all statuses correctly — Completed', async () => {
    seedUser(db, 'dc-1')
    seedBooking(db, 'dc-1', { status: 'Completed' })
    seedBooking(db, 'dc-1', { status: 'Cancelled' })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _listByStatus(ctx, { status: 'Completed' })
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Completed')
  })
})

// ─── _listByResource ──────────────────────────────────────────────────────────

describe('_listByResource', () => {
  let db: MockDb

  beforeEach(() => {
    db = new MockDb()
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx(db, null)
    await expectConvexError(
      _listByResource(ctx, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
      'UNAUTHENTICATED',
    )
  })

  it('throws USER_NOT_PROVISIONED when user does not exist', async () => {
    const ctx = makeCtx(db, 'clerk|instructor-1')
    await expectConvexError(
      _listByResource(ctx, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
      'USER_NOT_PROVISIONED',
    )
  })

  it('throws FORBIDDEN when caller slug does not match resourceId', async () => {
    seedUser(db, 'instructor-2', 'Instructor')
    const ctx = makeCtx(db, 'clerk|instructor-2')
    await expectConvexError(
      _listByResource(ctx, { resourceId: 'instructor-1', resourceType: 'Instructor' }),
      'FORBIDDEN',
    )
  })

  it('returns empty array when no bookings assigned to resource', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _listByResource(ctx, { resourceId: 'instructor-1', resourceType: 'Instructor' })
    expect(result).toHaveLength(0)
  })

  it('returns bookings where instructor is assigned', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    seedBooking(db, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
    seedBooking(db, 'dc-1', { status: 'Draft', instructorId: 'instructor-1' })
    seedBooking(db, 'dc-1', { status: 'Upcoming' }) // no instructor assigned
    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _listByResource(ctx, { resourceId: 'instructor-1', resourceType: 'Instructor' })
    expect(result).toHaveLength(2)
  })

  it('works for Boat resource type', async () => {
    seedUser(db, 'boat-owner-1', 'Boat')
    seedBooking(db, 'dc-1', { status: 'Upcoming', boatId: 'boat-owner-1' })
    seedBooking(db, 'dc-1', { status: 'Draft', boatId: 'boat-owner-1' })
    const ctx = makeCtx(db, 'clerk|boat-owner-1')
    const result = await _listByResource(ctx, { resourceId: 'boat-owner-1', resourceType: 'Boat' })
    expect(result).toHaveLength(2)
  })

  it('works for Equipment resource type', async () => {
    seedUser(db, 'em-1', 'Equipment')
    seedBooking(db, 'dc-1', { status: 'Upcoming', equipmentManagerId: 'em-1' })
    const ctx = makeCtx(db, 'clerk|em-1')
    const result = await _listByResource(ctx, { resourceId: 'em-1', resourceType: 'Equipment' })
    expect(result).toHaveLength(1)
  })

  it('works for Pool resource type', async () => {
    seedUser(db, 'pool-1', 'Pool')
    seedBooking(db, 'dc-1', { status: 'Draft', poolId: 'pool-1' })
    const ctx = makeCtx(db, 'clerk|pool-1')
    const result = await _listByResource(ctx, { resourceId: 'pool-1', resourceType: 'Pool' })
    expect(result).toHaveLength(1)
  })

  it('works for Compressor resource type', async () => {
    seedUser(db, 'comp-1', 'Compressor')
    seedBooking(db, 'dc-1', { status: 'Draft', compressorId: 'comp-1' })
    const ctx = makeCtx(db, 'clerk|comp-1')
    const result = await _listByResource(ctx, { resourceId: 'comp-1', resourceType: 'Compressor' })
    expect(result).toHaveLength(1)
  })

  it('denormalizes boatName from name map', async () => {
    seedUser(db, 'boat-owner-1', 'Boat')
    seedBooking(db, 'dc-1', { status: 'Upcoming', boatId: 'boat-owner-1' })
    const ctx = makeCtx(db, 'clerk|boat-owner-1')
    const result = await _listByResource(ctx, { resourceId: 'boat-owner-1', resourceType: 'Boat' })
    expect(result[0].boatName).toBe('boat-owner-1 Display')
  })
})

// ─── _myDashboard ─────────────────────────────────────────────────────────────

describe('_myDashboard', () => {
  let db: MockDb

  beforeEach(() => {
    db = new MockDb()
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx(db, null)
    await expectConvexError(_myDashboard(ctx), 'UNAUTHENTICATED')
  })

  it('throws USER_NOT_PROVISIONED when user does not exist', async () => {
    const ctx = makeCtx(db, 'clerk|dc-1')
    await expectConvexError(_myDashboard(ctx), 'USER_NOT_PROVISIONED')
  })

  it('returns empty dashboard for operator with no bookings', async () => {
    seedUser(db, 'dc-1', 'DiveCenter')
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _myDashboard(ctx)
    expect(result).toEqual({ bookings: [], requests: [] })
  })

  it('operator role: returns only Upcoming and Completed in bookings', async () => {
    seedUser(db, 'dc-1', 'DiveCenter')
    seedBooking(db, 'dc-1', { status: 'Draft' })
    seedBooking(db, 'dc-1', { status: 'Upcoming' })
    seedBooking(db, 'dc-1', { status: 'Completed' })
    seedBooking(db, 'dc-1', { status: 'Cancelled' })
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _myDashboard(ctx)
    expect(result.bookings).toHaveLength(2)
    const statuses = result.bookings.map((b) => b.status)
    expect(statuses).toContain('Upcoming')
    expect(statuses).toContain('Completed')
  })

  it('operator role: returns empty requests array', async () => {
    seedUser(db, 'dc-1', 'DiveCenter')
    const ctx = makeCtx(db, 'clerk|dc-1')
    const result = await _myDashboard(ctx)
    expect(result.requests).toEqual([])
  })

  it('resource role: returns calendar bookings from confirmed assignments', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    seedInventoryUnit(db, 'instructor-1', 'Instructor')
    seedBooking(db, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })
    seedBooking(db, 'dc-1', { status: 'Completed', instructorId: 'instructor-1' })
    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _myDashboard(ctx)
    expect(result.bookings).toHaveLength(2)
  })

  it('resource role: returns pending reservations as requests', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    const iuId = seedInventoryUnit(db, 'instructor-1', 'Instructor')

    // Draft booking from an operator requesting the instructor
    const bookingId = seedBooking(db, 'dc-1', {
      status: 'Draft',
      operatorName: 'Ocean DC',
      activityType: ['OW', 'AOW'],
    })

    // Pending reservation linking the booking to the instructor's inventory unit
    db.seed('reservations', {
      bookingId,
      inventoryUnitId: iuId,
      bookingSessionId: 'bookingSessions:999',
      unitsRequested: 1,
      status: 'PendingAcceptance',
      expiresAt: Date.now() + 43_200_000,
    })

    // Sessions for that booking
    db.seed('bookingSessions', {
      bookingId,
      inventoryUnitId: iuId,
      date: '2025-07-10',
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
    })
    db.seed('bookingSessions', {
      bookingId,
      inventoryUnitId: iuId,
      date: '2025-07-11',
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
    })

    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _myDashboard(ctx)

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
    seedUser(db, 'instructor-1', 'Instructor')
    const iuId = seedInventoryUnit(db, 'instructor-1', 'Instructor')

    const bookingId = seedBooking(db, 'dc-1', {
      status: 'Draft',
      operatorName: 'Ocean DC',
    })

    db.seed('reservations', {
      bookingId,
      inventoryUnitId: iuId,
      bookingSessionId: 'bookingSessions:999',
      unitsRequested: 1,
      status: 'PendingAcceptance',
    })

    // Two sessions on the same date (AM and PM)
    db.seed('bookingSessions', {
      bookingId,
      inventoryUnitId: iuId,
      date: '2025-07-10',
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
    })
    db.seed('bookingSessions', {
      bookingId,
      inventoryUnitId: iuId,
      date: '2025-07-10',
      startTime: '14:00',
      endTime: '16:00',
      timezone: 'Asia/Bangkok',
    })

    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _myDashboard(ctx)

    expect(result.requests[0].dates).toEqual(['2025-07-10'])
  })

  it('resource role: skips requests for non-existent bookings', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    const iuId = seedInventoryUnit(db, 'instructor-1', 'Instructor')

    // Reservation pointing to a deleted/missing booking
    db.seed('reservations', {
      bookingId: 'bookings:ghost',
      inventoryUnitId: iuId,
      bookingSessionId: 'bookingSessions:999',
      unitsRequested: 1,
      status: 'PendingAcceptance',
    })

    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _myDashboard(ctx)
    expect(result.requests).toHaveLength(0)
  })

  it('resource role: only surfaces PendingAcceptance reservations (not Confirmed)', async () => {
    seedUser(db, 'instructor-1', 'Instructor')
    const iuId = seedInventoryUnit(db, 'instructor-1', 'Instructor')

    const bookingId = seedBooking(db, 'dc-1', { status: 'Upcoming', instructorId: 'instructor-1' })

    // Confirmed reservation — should NOT appear in requests
    db.seed('reservations', {
      bookingId,
      inventoryUnitId: iuId,
      bookingSessionId: 'bookingSessions:999',
      unitsRequested: 1,
      status: 'Confirmed',
    })

    const ctx = makeCtx(db, 'clerk|instructor-1')
    const result = await _myDashboard(ctx)

    expect(result.bookings).toHaveLength(1)
    expect(result.requests).toHaveLength(0)
  })

  it('DiveMaster role: uses by_instructorId index same as Instructor', async () => {
    seedUser(db, 'dm-1', 'DiveMaster')
    seedInventoryUnit(db, 'dm-1', 'Instructor')
    seedBooking(db, 'dc-1', { status: 'Upcoming', instructorId: 'dm-1' })
    const ctx = makeCtx(db, 'clerk|dm-1')
    const result = await _myDashboard(ctx)
    expect(result.bookings).toHaveLength(1)
  })
})
