// Mock the Convex generated server module before any imports.
// vitest hoists vi.mock() calls before imports, so order here doesn't matter.
import { vi } from 'vitest'

vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
}))

import { describe, it, expect, beforeEach } from 'vitest'
import {
  _handler,
  releaseBookingReservations,
  tryAutoAdvance,
} from '../convex/bookingsMutations'

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

  /** Seed a record with a deterministic ID (for test setup). */
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

  /** Return all records in a table (for assertions). */
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

const HOLD_TTL = 43_200_000 // 12 hours

function seedUser(db: MockDb, slug: string): string {
  return db.seed('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test DC',
    role: 'DiveCenter',
    isSeeded: false,
    preferredLocale: 'en',
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
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: '2025-06-15',
    endDate: '2025-06-17',
    divers: [],
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
  capacityModel: 'Exclusive' | 'Pooled',
  totalUnits: number,
  ownerId = 'instructor-1',
): string {
  return db.seed('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: `${ownerId} unit`,
    capacityModel,
    totalUnits,
    ownerId,
    ownerType: 'Instructor',
  })
}

function makeSession(
  inventoryUnitId: string,
  date = '2025-06-15',
  unitsRequested = 1,
  startTime = '09:00',
  endTime = '11:00',
) {
  return {
    inventoryUnitId,
    date,
    startTime,
    endTime,
    timezone: 'Asia/Bangkok',
    unitsRequested,
  }
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ data: { code } })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitToDraft', () => {
  let db: MockDb
  let userSlug: string

  beforeEach(() => {
    db = new MockDb()
    userSlug = 'dc-test'
    seedUser(db, userSlug)
  })

  it('1 — single booking: creates reservation + snapshot (Exclusive)', async () => {
    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Exclusive', 1)
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await _handler(ctx, { bookingId, sessions: [makeSession(unitId)] })

    const reservations = db.all('reservations')
    expect(reservations).toHaveLength(1)
    expect(reservations[0].status).toBe('PendingAcceptance')
    expect(reservations[0].unitsRequested).toBe(1)

    const snapshots = db.all('availabilitySnapshots')
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].availableUnits).toBe(0)
    expect(snapshots[0].reservedUnits).toBe(1)

    const booking = await db.get(bookingId)
    expect(booking?.bookingFormComplete).toBe(true)
    expect(booking?.expiresAt).toBeGreaterThan(Date.now())
  })

  it('2 — Invariant 1: CONFLICT when Exclusive unit is already fully held', async () => {
    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Exclusive', 1)
    db.seed('availabilitySnapshots', {
      inventoryUnitId: unitId,
      date: '2025-06-15',
      windowStart: '09:00',
      windowEnd: '11:00',
      totalUnits: 1,
      reservedUnits: 1,
      availableUnits: 0,
    })
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await expectConvexError(
      _handler(ctx, { bookingId, sessions: [makeSession(unitId)] }),
      'CONFLICT',
    )
  })

  it('3 — Invariant 2: CONFLICT when Pooled unit lacks sufficient capacity', async () => {
    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Pooled', 10)
    // 3 available, requesting 4
    db.seed('availabilitySnapshots', {
      inventoryUnitId: unitId,
      date: '2025-06-15',
      windowStart: '09:00',
      windowEnd: '11:00',
      totalUnits: 10,
      reservedUnits: 7,
      availableUnits: 3,
    })
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await expectConvexError(
      _handler(ctx, { bookingId, sessions: [makeSession(unitId, '2025-06-15', 4)] }),
      'CONFLICT',
    )
  })

  it('4 — Pooled success at boundary: fills exactly remaining capacity', async () => {
    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Pooled', 5)
    db.seed('availabilitySnapshots', {
      inventoryUnitId: unitId,
      date: '2025-06-15',
      windowStart: '09:00',
      windowEnd: '11:00',
      totalUnits: 5,
      reservedUnits: 0,
      availableUnits: 5,
    })
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await _handler(ctx, { bookingId, sessions: [makeSession(unitId, '2025-06-15', 5)] })

    const snapshots = db.all('availabilitySnapshots')
    expect(snapshots[0].availableUnits).toBe(0)
    expect(snapshots[0].reservedUnits).toBe(5)
  })

  it('5 — mixed resources: creates reservation + snapshot for each resource type', async () => {
    const bookingId = seedBooking(db, userSlug)
    const exclusiveId = seedInventoryUnit(db, 'Exclusive', 1, 'instructor-1')
    const pooledId = seedInventoryUnit(db, 'Pooled', 20, 'boat-1')
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await _handler(ctx, {
      bookingId,
      sessions: [
        makeSession(exclusiveId, '2025-06-15', 1),
        makeSession(pooledId, '2025-06-15', 4),
      ],
    })

    expect(db.all('reservations')).toHaveLength(2)

    const snapshots = db.all('availabilitySnapshots')
    expect(snapshots).toHaveLength(2)

    const exclSnap = snapshots.find((s) => s.inventoryUnitId === exclusiveId)
    const poolSnap = snapshots.find((s) => s.inventoryUnitId === pooledId)
    expect(exclSnap?.availableUnits).toBe(0)
    expect(poolSnap?.availableUnits).toBe(16)
  })

  it('6 — UNAUTHENTICATED when identity is missing', async () => {
    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Exclusive', 1)
    const ctx = makeCtx(db, null)

    await expectConvexError(
      _handler(ctx, { bookingId, sessions: [makeSession(unitId)] }),
      'UNAUTHENTICATED',
    )
  })

  it('7 — BLOCKED_DATE when session date is in user blockedDates', async () => {
    const users = db.all('users')
    const user = users.find((u) => u.slug === userSlug)!
    await db.patch(user._id as string, { blockedDates: ['2025-06-15'] })

    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Exclusive', 1)
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await expectConvexError(
      _handler(ctx, { bookingId, sessions: [makeSession(unitId, '2025-06-15')] }),
      'BLOCKED_DATE',
    )
  })

  it('8 — edit mode: vacates old reservations + restores snapshots before re-hold', async () => {
    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Exclusive', 1)
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    // First submission — places hold on 2025-06-15
    await _handler(ctx, { bookingId, sessions: [makeSession(unitId, '2025-06-15')] })
    expect(db.all('availabilitySnapshots')[0].availableUnits).toBe(0)

    // Second submission (edit) — hold on 2025-06-16 instead
    await _handler(ctx, { bookingId, sessions: [makeSession(unitId, '2025-06-16')] })

    const reservations = db.all('reservations')
    const vacated = reservations.filter((r) => r.status === 'Vacated')
    const active = reservations.filter((r) => r.status === 'PendingAcceptance')

    expect(vacated).toHaveLength(1)
    expect(vacated[0].vacatedBy).toBe('operator_edit')
    expect(active).toHaveLength(1)

    // Original 2025-06-15 snapshot should be restored to availableUnits=1
    const snapshots = db.all('availabilitySnapshots')
    const originalSnap = snapshots.find(
      (s) => s.date === '2025-06-15' && s.inventoryUnitId === unitId,
    )
    expect(originalSnap?.availableUnits).toBe(1)
  })

  it('9 — Auto acceptance mode: reservation created as Confirmed', async () => {
    const bookingId = seedBooking(db, userSlug)
    const unitId = seedInventoryUnit(db, 'Exclusive', 1, 'instructor-auto')
    db.seed('stakeholderPreferences', {
      stakeholderId: 'instructor-auto',
      stakeholderType: 'Instructor',
      acceptanceMode: 'Auto',
      maxHoursPerDay: 8,
      postJobBlockDuration: 0,
      useNamedUnits: false,
      commonLanguageCodes: ['en'],
      confirmOnAccept: true,
      confirmOnDecline: true,
    })
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await _handler(ctx, { bookingId, sessions: [makeSession(unitId)] })

    const reservations = db.all('reservations')
    expect(reservations[0].status).toBe('Confirmed')
    expect(reservations[0].confirmedAt).toBeDefined()
  })

  it('10 — auto-advances to Upcoming when all conditions are satisfied', async () => {
    // customerFormComplete already done; auto-confirm instructor means reservations = Confirmed
    const bookingId = seedBooking(db, userSlug, { customerFormComplete: true })
    const unitId = seedInventoryUnit(db, 'Exclusive', 1, 'instructor-autoadvance')
    db.seed('stakeholderPreferences', {
      stakeholderId: 'instructor-autoadvance',
      acceptanceMode: 'Auto',
    })
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await _handler(ctx, { bookingId, sessions: [makeSession(unitId)] })

    const booking = await db.get(bookingId)
    expect(booking?.status).toBe('Upcoming')
  })

  it('11 — all-or-nothing: CONFLICT on any session prevents all writes', async () => {
    const bookingId = seedBooking(db, userSlug)
    const goodUnitId = seedInventoryUnit(db, 'Pooled', 10, 'boat-good')
    const busyUnitId = seedInventoryUnit(db, 'Exclusive', 1, 'instructor-busy')
    // Exclusive unit already held
    db.seed('availabilitySnapshots', {
      inventoryUnitId: busyUnitId,
      date: '2025-06-15',
      windowStart: '09:00',
      windowEnd: '11:00',
      totalUnits: 1,
      reservedUnits: 1,
      availableUnits: 0,
    })
    const ctx = makeCtx(db, `clerk|${userSlug}`)

    await expectConvexError(
      _handler(ctx, {
        bookingId,
        sessions: [
          makeSession(goodUnitId, '2025-06-15', 4), // ok
          makeSession(busyUnitId, '2025-06-15', 1), // conflicts
        ],
      }),
      'CONFLICT',
    )

    // Zero writes: no reservations, no new snapshot for the good unit
    expect(db.all('reservations')).toHaveLength(0)
    const goodUnitSnapshots = db
      .all('availabilitySnapshots')
      .filter((s) => s.inventoryUnitId === goodUnitId)
    expect(goodUnitSnapshots).toHaveLength(0)
  })
})

// ─── Helper function tests ────────────────────────────────────────────────────

describe('releaseBookingReservations', () => {
  it('vacates active reservations and restores snapshot counts', async () => {
    const db = new MockDb()
    const unitId = db.seed('inventoryUnits', {
      capacityModel: 'Exclusive',
      totalUnits: 1,
      ownerId: 'instructor-1',
    })
    const snapshotId = db.seed('availabilitySnapshots', {
      inventoryUnitId: unitId,
      date: '2025-06-15',
      windowStart: '09:00',
      windowEnd: '11:00',
      totalUnits: 1,
      reservedUnits: 1,
      availableUnits: 0,
    })
    const sessionId = db.seed('bookingSessions', {
      bookingId: 'bookings:1',
      inventoryUnitId: unitId,
      date: '2025-06-15',
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
    })
    const resId = db.seed('reservations', {
      bookingId: 'bookings:1',
      inventoryUnitId: unitId,
      bookingSessionId: sessionId,
      unitsRequested: 1,
      status: 'PendingAcceptance',
    })

    const ctx = makeCtx(db, null)
    await releaseBookingReservations(ctx, 'bookings:1', 'booking_cancelled')

    const res = await db.get(resId)
    expect(res?.status).toBe('Vacated')
    expect(res?.vacatedBy).toBe('booking_cancelled')

    const snap = await db.get(snapshotId)
    expect(snap?.availableUnits).toBe(1)
    expect(snap?.reservedUnits).toBe(0)
  })
})

describe('tryAutoAdvance', () => {
  it('advances to Upcoming when all conditions are met', async () => {
    const db = new MockDb()
    const bookingId = db.seed('bookings', {
      status: 'Draft',
      bookingFormComplete: true,
      customerFormComplete: true,
      medicalHardBlock: false,
    })
    db.seed('reservations', {
      bookingId,
      status: 'Confirmed',
    })

    const ctx = makeCtx(db, null)
    await tryAutoAdvance(ctx, bookingId)

    const booking = await db.get(bookingId)
    expect(booking?.status).toBe('Upcoming')
  })

  it('stays Draft when customerFormComplete is false', async () => {
    const db = new MockDb()
    const bookingId = db.seed('bookings', {
      status: 'Draft',
      bookingFormComplete: true,
      customerFormComplete: false,
      medicalHardBlock: false,
    })
    db.seed('reservations', { bookingId, status: 'Confirmed' })

    const ctx = makeCtx(db, null)
    await tryAutoAdvance(ctx, bookingId)

    const booking = await db.get(bookingId)
    expect(booking?.status).toBe('Draft')
  })

  it('stays Draft when medical hard block is active', async () => {
    const db = new MockDb()
    const bookingId = db.seed('bookings', {
      status: 'Draft',
      bookingFormComplete: true,
      customerFormComplete: true,
      medicalHardBlock: true,
    })
    db.seed('reservations', { bookingId, status: 'Confirmed' })

    const ctx = makeCtx(db, null)
    await tryAutoAdvance(ctx, bookingId)

    const booking = await db.get(bookingId)
    expect(booking?.status).toBe('Draft')
  })
})
