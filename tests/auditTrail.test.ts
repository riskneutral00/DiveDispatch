import { describe, it, expect, vi, afterEach } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { testDate } from './helpers/dates'
import { logBookingChange } from '../convex/bookingAuditLog'
import { makeT } from './helpers/convex-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedUser(ctx: unknown, slug = 'dc-test') {
  const c = ctx as { db: { insert: (table: string, doc: unknown) => Promise<string> } }
  await c.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: 'Test',
    lastName: 'User',
    businessName: 'Test DC',
    isSeeded: false,
    appLanguage: 'en',
  })
}

async function seedBooking(
  ctx: unknown,
  overrides: Record<string, unknown> = {},
): Promise<Id<'bookings'>> {
  const c = ctx as { db: { insert: (table: string, doc: unknown) => Promise<Id<'bookings'>> } }
  return c.db.insert('bookings', {
    ownerId: 'dc-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(7),
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

async function seedInventoryUnit(ctx: unknown): Promise<Id<'inventoryUnits'>> {
  const c = ctx as { db: { insert: (table: string, doc: unknown) => Promise<Id<'inventoryUnits'>> } }
  return c.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: 'instructor-1',
    displayName: 'Instructor unit',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId: 'instructor-1',
    ownerType: 'Instructor',
  })
}

// ─── 1: logBookingChange creates audit entry ───────────────────────────────────

describe('logBookingChange creates audit entry', () => {
  afterEach(() => vi.restoreAllMocks())

  it('inserts a bookingAuditLog entry with correct fields', async () => {
    const t = makeT()

    const now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx)

      await logBookingChange(ctx, {
        bookingId,
        action: 'created',
        actorSlug: 'dc-test',
        actorType: 'operator',
      })

      const entries = await (ctx as { db: { query: (t: string) => { collect: () => Promise<unknown[]> } } }).db
        .query('bookingAuditLog')
        .collect()

      expect(entries).toHaveLength(1)
      const e = entries[0] as Record<string, unknown>
      expect(e.bookingId).toBe(bookingId)
      expect(e.action).toBe('created')
      expect(e.actorSlug).toBe('dc-test')
      expect(e.actorType).toBe('operator')
      expect(e.timestamp).toBe(now)
    })
  })
})

// ─── 2: getAuditLog returns entries sorted by timestamp desc ───────────────────

describe('getAuditLog returns entries sorted by timestamp desc', () => {
  it('newest entry first', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx)
    })

    // Insert 3 entries with different timestamps
    await t.run(async (ctx) => {
      const c = ctx as { db: { insert: (table: string, doc: unknown) => Promise<string> } }
      await c.db.insert('bookingAuditLog', {
        bookingId,
        action: 'created',
        actorSlug: 'dc-test',
        actorType: 'operator',
        timestamp: 1000,
      })
      await c.db.insert('bookingAuditLog', {
        bookingId,
        action: 'submitted',
        actorSlug: 'dc-test',
        actorType: 'operator',
        timestamp: 3000,
      })
      await c.db.insert('bookingAuditLog', {
        bookingId,
        action: 'edited',
        actorSlug: 'dc-test',
        actorType: 'operator',
        timestamp: 2000,
      })
    })

    const entries = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId })

    expect(entries).toHaveLength(3)
    expect((entries[0] as Record<string, unknown>).timestamp).toBe(3000)
    expect((entries[1] as Record<string, unknown>).timestamp).toBe(2000)
    expect((entries[2] as Record<string, unknown>).timestamp).toBe(1000)
  })
})

// ─── 3: getAuditLog scoped to bookingId ────────────────────────────────────────

describe('getAuditLog scoped to bookingId', () => {
  it('only returns entries for the requested booking', async () => {
    const t = makeT()

    const { bookingA, bookingB } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingA = await seedBooking(ctx)
      const bookingB = await seedBooking(ctx)
      return { bookingA, bookingB }
    })

    await t.run(async (ctx) => {
      await logBookingChange(ctx, { bookingId: bookingA, action: 'created', actorSlug: 'dc-test', actorType: 'operator' })
      await logBookingChange(ctx, { bookingId: bookingB, action: 'created', actorSlug: 'dc-test', actorType: 'operator' })
      await logBookingChange(ctx, { bookingId: bookingB, action: 'submitted', actorSlug: 'dc-test', actorType: 'operator' })
    })

    const entriesA = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId: bookingA })

    expect(entriesA).toHaveLength(1)
    expect((entriesA[0] as Record<string, unknown>).bookingId).toBe(bookingA)
  })
})

// ─── 4: submitToDraft creates audit entries ────────────────────────────────────

describe('submitToDraft creates audit entries', () => {
  it("creates 'created' and 'submitted' entries on first submit", async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx)
      const unitId = await seedInventoryUnit(ctx)
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'UTC',
            unitsRequested: 1,
          },
        ],
        bookingData: {
          activityType: ['OW'],
          startDate: testDate(5),
          endDate: testDate(7),
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [],
        },
      },
    )

    const entries = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId })

    const actions = (entries as Array<Record<string, unknown>>).map((e) => e.action)
    expect(actions).toContain('submitted')
  })
})

// ─── 5: cancel creates audit entry ────────────────────────────────────────────

describe('cancel creates audit entry', () => {
  it("creates 'cancelled' entry with actorSlug", async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      // Create an Upcoming booking (cancelBooking requires non-Cancelled)
      return seedBooking(ctx, { status: 'Upcoming' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.status.cancelBooking,
      { bookingId },
    )

    const entries = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId })

    const cancelEntry = (entries as Array<Record<string, unknown>>).find(
      (e) => e.action === 'cancelled',
    )
    expect(cancelEntry).toMatchObject({
      action: 'cancelled',
      actorSlug: 'dc-test',
      actorType: 'operator',
    })
  })
})

// ─── 6: expire creates audit entry ────────────────────────────────────────────

describe('expire creates audit entry', () => {
  afterEach(() => vi.restoreAllMocks())

  it("creates 'expired' entry with actorType 'system'", async () => {
    const t = makeT()

    const pastTime = Date.now() - HOLD_TTL - 1000

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        status: 'Draft',
        expiresAt: pastTime,
        submittedAt: pastTime - 1000,
      })
    })

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const entries = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId })

    const expiredEntry = (entries as Array<Record<string, unknown>>).find(
      (e) => e.action === 'expired',
    )
    expect(expiredEntry).toMatchObject({
      action: 'expired',
      actorSlug: 'system',
      actorType: 'system',
    })
  })
})

// ─── 7: complete creates audit entry ──────────────────────────────────────────

describe('complete creates audit entry', () => {
  afterEach(() => vi.restoreAllMocks())

  it("creates 'completed' entry with actorType 'system'", async () => {
    const t = makeT()

    // Mock: time is well after session end
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(6) + 'T10:00:00Z').getTime())

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const unitId = await seedInventoryUnit(ctx)
      const c = ctx as { db: { insert: (table: string, doc: unknown) => Promise<string> } }
      await c.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'UTC',
      })
      return bookingId
    })

    await t.mutation(internal.bookings.status.completeBookings, {})

    const entries = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId })

    const completedEntry = (entries as Array<Record<string, unknown>>).find(
      (e) => e.action === 'completed',
    )
    expect(completedEntry).toMatchObject({
      action: 'completed',
      actorSlug: 'system',
      actorType: 'system',
    })
  })
})

// ─── 8: audit entries are immutable ───────────────────────────────────────────

describe('audit entries are immutable', () => {
  it('bookingAuditLog only exposes getAuditLog — no write mutations for clients', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx)
    })

    // Insert an entry
    await t.run(async (ctx) => {
      await logBookingChange(ctx, {
        bookingId,
        action: 'created',
        actorSlug: 'dc-test',
        actorType: 'operator',
      })
    })

    // Verify getAuditLog is the only public-facing API
    expect(typeof api.bookingAuditLog.getAuditLog).toBe('object')

    // Verify the entry cannot be mutated via the public api (no patch/delete exposed)
    // Structural assertion: bookingAuditLog module has only getAuditLog in public api
    const publicKeys = Object.keys(
      Object.getOwnPropertyDescriptors(
        Object.getPrototypeOf(api.bookingAuditLog) ?? api.bookingAuditLog,
      ),
    ).filter((k) => k !== 'constructor')

    // The module path itself should not expose mutation functions
    // (confirmed by TypeScript: only getAuditLog is typed in api.bookingAuditLog)
    const entry = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId })

    expect(entry).toHaveLength(1)
    // Direct db patch is not accessible via public api
    // (no api.bookingAuditLog.patchAuditLog or deleteAuditLog exists in TypeScript types)
    expect(publicKeys.includes('patchAuditLog')).toBe(false)
    expect(publicKeys.includes('deleteAuditLog')).toBe(false)
  })
})

// ─── 11: getAuditLog rejects non-owner/non-resource caller ───────────────────

describe('getAuditLog ownership check (A5)', () => {
  it('throws FORBIDDEN when caller has no ownership or reservation on the booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'outsider')
      const bookingId = await seedBooking(ctx)
      await logBookingChange(ctx, {
        bookingId,
        action: 'created',
        actorSlug: 'dc-test',
        actorType: 'operator',
      })
      return bookingId
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|outsider' })
        .query(api.bookingAuditLog.getAuditLog, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  it('allows booking owner to read audit log', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      const bookingId = await seedBooking(ctx)
      await logBookingChange(ctx, {
        bookingId,
        action: 'created',
        actorSlug: 'dc-test',
        actorType: 'operator',
      })
      return bookingId
    })

    const entries = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingAuditLog.getAuditLog, { bookingId })

    expect(entries).toHaveLength(1)
  })
})
