import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  _getUnavailableUnitIdsForDates,
  _getCapacityForDates,
  _getBlockedDatesForStakeholder,
  _listInventoryByType,
  _toggleBlockedDate,
} from '../convex/availability'
import { isFullDayResource, releaseBookingReservations } from '../convex/bookings/_shared'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
  seedBlockedDates,
  seedBooking,
  seedSession,
  seedReservation,
} from './fixtures'
import { testDate, malformedDate } from './helpers/dates'
import { todayISO } from '../convex/bookings/stateMachine'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── getUnavailableUnitIdsForDates ────────────────────────────────────────────

describe('_getUnavailableUnitIdsForDates', () => {
  it('returns empty set when no snapshots exist', async () => {
    await t.run(async (ctx) => {
      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.size).toBe(0)
    })
  })

  it('returns empty set when all snapshots have availableUnits > 0', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx)
      await seedSnapshot(ctx, unitId, { totalUnits: 10, reservedUnits: 3, availableUnits: 7 })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.size).toBe(0)
    })
  })

  it('includes unit when Exclusive snapshot has availableUnits === 0', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedSnapshot(ctx, unitId, { totalUnits: 1, reservedUnits: 1, availableUnits: 0 })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.has(unitId)).toBe(true)
    })
  })

  it('includes unit when Pooled snapshot has availableUnits === 0', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(7),
        totalUnits: 10,
        reservedUnits: 10,
        availableUnits: 0,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(7)])
      expect(result.has(unitId)).toBe(true)
    })
  })

  it('does not include unit where availableUnits > 0', async () => {
    await t.run(async (ctx) => {
      const fullUnitId = await seedInventoryUnit(ctx, { resourceType: 'Instructor' })
      const availUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: TEST_SLUGS.em,
      })
      await seedSnapshot(ctx, fullUnitId, { totalUnits: 1, reservedUnits: 1, availableUnits: 0 })
      await seedSnapshot(ctx, availUnitId, { totalUnits: 10, reservedUnits: 3, availableUnits: 7 })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.has(fullUnitId)).toBe(true)
      expect(result.has(availUnitId)).toBe(false)
    })
  })

  it('deduplicates unit IDs when unit is unavailable on multiple queried dates', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx)
      // Same unit fully booked on two different dates
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(7),
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5), testDate(7)])
      expect(result.size).toBe(1)
      expect(result.has(unitId)).toBe(true)
    })
  })

  it('returns empty set when dates array is empty', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx)
      await seedSnapshot(ctx, unitId, { totalUnits: 1, reservedUnits: 1, availableUnits: 0 })

      const result = await _getUnavailableUnitIdsForDates(ctx, [])
      expect(result.size).toBe(0)
    })
  })

  it('marks unit unavailable when any window has availableUnits === 0', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      // One window available, one full — unit still flagged
      await seedSnapshot(ctx, unitId, {
        windowStart: '08:00',
        windowEnd: '12:00',
        totalUnits: 10,
        reservedUnits: 3,
        availableUnits: 7,
      })
      await seedSnapshot(ctx, unitId, {
        windowStart: '12:00',
        windowEnd: '16:00',
        totalUnits: 10,
        reservedUnits: 10,
        availableUnits: 0,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.has(unitId)).toBe(true)
    })
  })
})

// ─── listInventoryByType ──────────────────────────────────────────────────────

describe('_listInventoryByType', () => {
  it('returns all units of a given type with joined ownerName', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: TEST_SLUGS.instructor,
        businessName: 'Blue Ocean Dive',
        role: 'Instructor',
        tokenIdentifier: TEST_TOKENS.instructor,
        email: 'instr@test.com',
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'John Doe',
        ownerId: TEST_SLUGS.instructor,
      })

      const result = await _listInventoryByType(ctx, { type: 'Instructor' })

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: unitId,
        name: 'John Doe',
        type: 'Instructor',
        ownerId: TEST_SLUGS.instructor,
        ownerName: 'Blue Ocean Dive',
      })
    })
  })

  it('returns empty array when no units of that type exist', async () => {
    await t.run(async (ctx) => {
      // Insert an Instructor unit — should not appear when querying Boat
      await seedInventoryUnit(ctx, { resourceType: 'Instructor' })

      const result = await _listInventoryByType(ctx, { type: 'Boat' })
      expect(result).toHaveLength(0)
    })
  })

  it('filters to ownerSlug when provided', async () => {
    await t.run(async (ctx) => {
      const unitA = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: TEST_SLUGS.instructor,
      })
      // Second unit with a different owner
      await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'other-instructor',
        ownerType: 'Instructor',
      })

      const result = await _listInventoryByType(ctx, {
        type: 'Instructor',
        ownerSlug: TEST_SLUGS.instructor,
      })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(unitA)
    })
  })

  it('returns all units when ownerSlug is not provided', async () => {
    await t.run(async (ctx) => {
      await seedInventoryUnit(ctx, { resourceType: 'Instructor', ownerId: TEST_SLUGS.instructor })
      await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'other-instructor',
        ownerType: 'Instructor',
        displayName: 'Jane Smith',
      })

      const result = await _listInventoryByType(ctx, { type: 'Instructor' })
      expect(result).toHaveLength(2)
    })
  })

  it('falls back to displayName when owner user is not found', async () => {
    await t.run(async (ctx) => {
      // Insert unit with ownerId that has NO corresponding user record
      await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'John Doe',
        ownerId: 'no-user-for-this-slug',
      })

      const result = await _listInventoryByType(ctx, { type: 'Instructor' })
      expect(result[0].ownerName).toBe('John Doe')
    })
  })

  it('returns correct shape for Pooled resource type', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        capacityModel: 'Pooled',
        totalUnits: 10,
        displayName: 'BCD Set',
        ownerId: TEST_SLUGS.em,
        ownerType: 'Equipment',
      })

      const result = await _listInventoryByType(ctx, { type: 'Equipment' })

      expect(result[0]).toMatchObject({
        id: unitId,
        name: 'BCD Set',
        type: 'Equipment',
        ownerId: TEST_SLUGS.em,
      })
    })
  })

  it('does not expose booking or reservation data', async () => {
    await t.run(async (ctx) => {
      await seedInventoryUnit(ctx, { resourceType: 'Instructor' })

      const result = await _listInventoryByType(ctx, { type: 'Instructor' })
      const item = result[0]

      expect(item).not.toHaveProperty('bookingId')
      expect(item).not.toHaveProperty('reservedUnits')
      expect(item).not.toHaveProperty('availableUnits')
    })
  })
})

// ─── toggleBlockedDate ────────────────────────────────────────────────────────

describe('_toggleBlockedDate', () => {
  it('blocks a date that was not previously blocked', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const result = await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' })

      expect(result).toBe(true)
      const doc = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_ownerSlug_roleType', (q: any) =>
          q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
        )
        .unique()
      expect(doc?.dates).toEqual([testDate(5)])
    })
  })

  it('unblocks a date that was previously blocked', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
        dates: [testDate(5)],
      })

      const result = await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' })

      expect(result).toBe(false)
      const doc = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_ownerSlug_roleType', (q: any) =>
          q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
        )
        .unique()
      expect(doc?.dates).toEqual([])
    })
  })

  it('is idempotent: second call re-blocks an unblocked date', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
        dates: [testDate(5)],
      })

      // First call unblocks
      await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' })
      // Second call blocks again
      const result = await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' })

      expect(result).toBe(true)
    })
  })

  it('handles undefined blockedDates (first block ever)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const result = await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' })

      expect(result).toBe(true)
      const doc = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_ownerSlug_roleType', (q: any) =>
          q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
        )
        .unique()
      expect(doc?.dates).toEqual([testDate(5)])
    })
  })

  it('throws UNAUTHENTICATED when identity is missing', async () => {
    await t.run(async (ctx) => {
      await expect(
        _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' }),
      ).rejects.toMatchObject({
        data: { code: 'UNAUTHENTICATED' },
      })
    })
  })

  it('throws NOT_FOUND when user record does not exist in Convex', async () => {
    // Identity present but no matching user in the DB
    await t.withIdentity({ tokenIdentifier: 'test|ghost-user' }).run(async (ctx) => {
      await expect(
        _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' }),
      ).rejects.toMatchObject({
        data: { code: 'NOT_FOUND' },
      })
    })
  })

  it('preserves other blocked dates when adding a new one', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
        dates: [testDate(3), testDate(10)],
      })

      await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' })

      const doc = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_ownerSlug_roleType', (q: any) =>
          q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
        )
        .unique()
      expect(doc?.dates).toEqual([testDate(3), testDate(10), testDate(5)])
    })
  })
  it('rejects date block when Confirmed reservation exists on that date', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })

      await expect(
        _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Instructor' }),
      ).rejects.toMatchObject({
        data: { code: 'CONFIRMED_RESERVATION_EXISTS' },
      })
    })
  })

  it('allows date block when only PendingAcceptance reservations exist (no Confirmed)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx)
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })

      const result = await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Instructor' })

      expect(result).toBe(true)

      // PendingAcceptance reservation should be vacated with date_blocked reason
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations[0].status).toBe('Vacated')
      expect(reservations[0].vacatedBy).toBe('date_blocked')
    })
  })

  it('vacates PendingAcceptance with DateBlocked reason, not StakeholderDeclined', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx)
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })

      await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Instructor' })

      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(1)
      expect(reservations[0].status).toBe('Vacated')
      expect(reservations[0].vacatedBy).toBe('date_blocked')
      // Must NOT be stakeholder_declined — that permanently blocks autoAdvance
      expect(reservations[0].vacatedBy).not.toBe('stakeholder_declined')
    })
  })

  it('rejects date block even if mix of Pending + Confirmed exists', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx)

      // Booking 1: Confirmed
      const booking1 = await seedBooking(ctx, { status: 'Upcoming' })
      const session1 = await seedSession(ctx, booking1, unitId)
      await seedReservation(ctx, booking1, unitId, session1, { status: 'Confirmed' })

      // Booking 2: PendingAcceptance
      const booking2 = await seedBooking(ctx)
      const session2 = await seedSession(ctx, booking2, unitId, { startTime: '09:00' })
      await seedReservation(ctx, booking2, unitId, session2, { status: 'PendingAcceptance' })

      await seedSnapshot(ctx, unitId, { totalUnits: 2, reservedUnits: 2, availableUnits: 0 })

      await expect(
        _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Instructor' }),
      ).rejects.toMatchObject({
        data: { code: 'CONFIRMED_RESERVATION_EXISTS' },
      })

      // Neither reservation should be touched
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations.find((r) => r.status === 'Confirmed')).toBeTruthy()
      expect(reservations.find((r) => r.status === 'PendingAcceptance')).toBeTruthy()
    })
  })

  it('allows unblocking a date regardless of reservation status', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.instructor,
        roleType: 'Instructor',
        dates: [testDate(5)],
      })

      // Unblocking should always work — no reservation check needed
      const result = await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Instructor' })
      expect(result).toBe(false)
    })
  })

  // ─── Past-date guard ────────────────────────────────────────────────────────

  describe('past-date guard', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('rejects blocking a date in the past', async () => {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
        await seedUser(ctx)

        await expect(
          _toggleBlockedDate(ctx, { date: testDate(-1), roleType: 'DiveCenter' }),
        ).rejects.toThrow('PAST_DATE')
      })
    })

    it('allows blocking today', async () => {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
        await seedUser(ctx)

        const result = await _toggleBlockedDate(ctx, { date: todayISO(), roleType: 'DiveCenter' })
        expect(result).toBe(true)
      })
    })

    it('allows blocking tomorrow', async () => {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
        await seedUser(ctx)

        const result = await _toggleBlockedDate(ctx, { date: testDate(1), roleType: 'DiveCenter' })
        expect(result).toBe(true)
      })
    })

    it('allows unblocking a past date (no past-date check on unblock path)', async () => {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
        await seedUser(ctx)
        // Seed a blocked date that is already in the past
        await seedBlockedDates(ctx, {
          ownerSlug: TEST_SLUGS.diveCenter,
          roleType: 'DiveCenter',
          dates: [testDate(-3)],
        })

        // Unblocking past dates should always work
        const result = await _toggleBlockedDate(ctx, { date: testDate(-3), roleType: 'DiveCenter' })
        expect(result).toBe(false)
      })
    })
  })

  // ─── Role isolation ─────────────────────────────────────────────────────────

  describe('role isolation', () => {
    it('blocking Instructor role does not affect Equipment dates for same owner', async () => {
      await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
        await seedUser(ctx, {
          tokenIdentifier: TEST_TOKENS.instructor,
          slug: TEST_SLUGS.instructor,
          role: 'Instructor',
        })

        // Block a date for Instructor role
        await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Instructor' })

        // Equipment role for same owner should have no blocked dates
        const equipDoc = await ctx.db
          .query('stakeholderBlockedDates')
          .withIndex('by_ownerSlug_roleType', (q: any) =>
            q.eq('ownerSlug', TEST_SLUGS.instructor).eq('roleType', 'Equipment'),
          )
          .unique()
        expect(equipDoc).toBeNull()
      })
    })

    it('blocking Boat role does not affect DiveCenter dates for same owner', async () => {
      await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
        await seedUser(ctx)

        // Block dates for two different roles
        await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Boat' })
        await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveCenter' })

        // Each role has its own isolated record
        const boatDoc = await ctx.db
          .query('stakeholderBlockedDates')
          .withIndex('by_ownerSlug_roleType', (q: any) =>
            q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'Boat'),
          )
          .unique()
        const dcDoc = await ctx.db
          .query('stakeholderBlockedDates')
          .withIndex('by_ownerSlug_roleType', (q: any) =>
            q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
          )
          .unique()

        expect(boatDoc?.dates).toEqual([testDate(5)])
        expect(dcDoc?.dates).toEqual([testDate(5)])

        // Unblock Boat — DiveCenter should be unaffected
        await _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'Boat' })
        const boatAfter = await ctx.db
          .query('stakeholderBlockedDates')
          .withIndex('by_ownerSlug_roleType', (q: any) =>
            q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'Boat'),
          )
          .unique()
        const dcAfter = await ctx.db
          .query('stakeholderBlockedDates')
          .withIndex('by_ownerSlug_roleType', (q: any) =>
            q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
          )
          .unique()

        expect(boatAfter?.dates).toEqual([])
        expect(dcAfter?.dates).toEqual([testDate(5)])
      })
    })

    it('DiveMaster block maps to Instructor resourceType for reservation check', async () => {
      await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
        await seedUser(ctx, {
          tokenIdentifier: TEST_TOKENS.instructor,
          slug: TEST_SLUGS.instructor,
          role: 'Instructor',
        })
        const unitId = await seedInventoryUnit(ctx, {
          resourceType: 'Instructor',
          capacityModel: 'Exclusive',
          totalUnits: 1,
          ownerId: TEST_SLUGS.instructor,
        })
        // Confirmed reservation on Instructor unit
        const bookingId = await seedBooking(ctx)
        const sessionId = await seedSession(ctx, bookingId, unitId)
        await seedReservation(ctx, bookingId, unitId, sessionId, {
          status: 'Confirmed',
        })

        // DiveMaster role should hit the Instructor reservation gate
        await expect(
          _toggleBlockedDate(ctx, { date: testDate(5), roleType: 'DiveMaster' }),
        ).rejects.toThrow('CONFIRMED_RESERVATION_EXISTS')
      })
    })
  })
})

// ─── getBlockedDatesForStakeholder (auth + privacy) ──────────────────────────

describe('_getBlockedDatesForStakeholder', () => {
  it('returns dates for the owning stakeholder', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
        dates: [testDate(5), testDate(10)],
      })

      const result = await _getBlockedDatesForStakeholder(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
      })
      expect(result).toEqual([testDate(5), testDate(10)])
    })
  })

  it('rejects unauthenticated caller', async () => {
    await t.run(async (ctx) => {
      await expect(
        _getBlockedDatesForStakeholder(ctx, {
          ownerSlug: TEST_SLUGS.diveCenter,
          roleType: 'DiveCenter',
        }),
      ).rejects.toThrow('UNAUTHENTICATED')
    })
  })

  it('returns empty array for a different users slug (silent deny)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor }).run(async (ctx) => {
      // Seed both users
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: TEST_SLUGS.diveCenter,
        role: 'DiveCenter',
      })
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
        dates: [testDate(5)],
      })

      // Instructor tries to query DiveCenter's blocked dates → silent deny
      const result = await _getBlockedDatesForStakeholder(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
      })
      expect(result).toEqual([])
    })
  })

  it('returns empty array when no blocked dates exist', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const result = await _getBlockedDatesForStakeholder(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
      })
      expect(result).toEqual([])
    })
  })
})

// ─── Full-day vs time-window overlap granularity ──────────────────────────────

describe('_getUnavailableUnitIdsForDates — full-day vs time-window', () => {
  it('10 — day boat with any reservation is unavailable for the entire date', async () => {
    await t.run(async (ctx) => {
      // Pooled day boat: capacity 2, one seat reserved — still has availableUnits > 0
      // but full-day logic must mark it unavailable regardless
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'day-boat-1',
        displayName: 'Day Boat',
        capacityModel: 'Pooled',
        totalUnits: 2,
        ownerId: 'day-boat-1',
        ownerType: 'Boat',
        boatType: 'day_boat',
      })
      // One seat reserved, one still available — but full-day blocks the whole date
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 2,
        reservedUnits: 1,
        availableUnits: 1,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.has(unitId)).toBe(true)
    })
  })

  it('11 — speedboat with morning reservation is still available for other windows', async () => {
    await t.run(async (ctx) => {
      // Pooled speedboat: 3 seats per trip, 1 seat reserved — availableUnits > 0
      // Time-window resource: NOT marked unavailable (capacity remains)
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'speedboat-1',
        displayName: 'Speedboat',
        capacityModel: 'Pooled',
        totalUnits: 3,
        ownerId: 'speedboat-1',
        ownerType: 'Boat',
        boatType: 'speedboat',
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '12:00',
        totalUnits: 3,
        reservedUnits: 1,
        availableUnits: 2,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.has(unitId)).toBe(false)
    })
  })

  it('12 — liveaboard with reservation is unavailable for the entire date', async () => {
    await t.run(async (ctx) => {
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'liveaboard-1',
        displayName: 'Liveaboard',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'liveaboard-1',
        ownerType: 'Boat',
        boatType: 'liveaboard',
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      expect(result.has(unitId)).toBe(true)
    })
  })

  it('boat without boatType defaults to time-window (safe fallback)', async () => {
    await t.run(async (ctx) => {
      // No boatType set — should NOT be treated as full-day
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'unknown-boat',
        displayName: 'Unknown Boat',
        capacityModel: 'Pooled',
        totalUnits: 2,
        ownerId: 'unknown-boat',
        ownerType: 'Boat',
      })
      // Partial reservation, availableUnits > 0
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 2,
        reservedUnits: 1,
        availableUnits: 1,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, [testDate(5)])
      // Time-window behavior: availableUnits > 0 → not unavailable
      expect(result.has(unitId)).toBe(false)
      // Confirm isFullDayResource respects the safe default
      expect(isFullDayResource({ resourceType: 'Boat' })).toBe(false)
    })
  })
})

// ─── getCapacityForDates (TDD — per-date availability for resource pickers) ──

describe('_getCapacityForDates', () => {
  it('Exclusive, no bookings → full capacity', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      const entry = result[unitId as string]?.[testDate(5)]
      // No snapshot → full capacity returned
      expect(entry).toEqual({ available: 1, total: 1 })
    })
  })

  it('Exclusive, one booking → zero available', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      const entry = result[unitId as string]?.[testDate(5)]
      expect(entry).toEqual({ available: 0, total: 1 })
    })
  })

  it('Pooled, no bookings → full capacity', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 20,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      const entry = result[unitId as string]?.[testDate(5)]
      expect(entry).toEqual({ available: 20, total: 20 })
    })
  })

  it('Pooled, partially booked → remaining capacity', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 20,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        totalUnits: 20,
        reservedUnits: 5,
        availableUnits: 15,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      const entry = result[unitId as string]?.[testDate(5)]
      expect(entry).toEqual({ available: 15, total: 20 })
    })
  })

  it('Pooled, fully booked → zero available', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 20,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        totalUnits: 20,
        reservedUnits: 20,
        availableUnits: 0,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      const entry = result[unitId as string]?.[testDate(5)]
      expect(entry).toEqual({ available: 0, total: 20 })
    })
  })

  it('multi-date: per-date granularity (available Day 1, full Day 2)', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      // Day 1: no snapshot (available)
      // Day 2: fully booked
      await seedSnapshot(ctx, unitId, {
        date: testDate(6),
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5), testDate(6)])
      expect(result[unitId as string]?.[testDate(5)]).toEqual({ available: 1, total: 1 })
      expect(result[unitId as string]?.[testDate(6)]).toEqual({ available: 0, total: 1 })
    })
  })

  it('no snapshot for date → returns full capacity from unit', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Pool',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      // Snapshot exists for a different date, not the queried date
      await seedSnapshot(ctx, unitId, {
        date: testDate(10),
        totalUnits: 10,
        reservedUnits: 5,
        availableUnits: 5,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      const entry = result[unitId as string]?.[testDate(5)]
      expect(entry).toEqual({ available: 10, total: 10 })
    })
  })

  it('snapshot restored after release → available again', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      // Snapshot shows released (available restored)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      const entry = result[unitId as string]?.[testDate(5)]
      expect(entry).toEqual({ available: 1, total: 1 })
    })
  })

  it('empty dates array → returns empty result', async () => {
    await t.run(async (ctx) => {
      await seedInventoryUnit(ctx, { resourceType: 'Instructor' })

      const result = await _getCapacityForDates(ctx, [])
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  it('multiple units: returns capacity for each independently', async () => {
    await t.run(async (ctx) => {
      const instrId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instr-a',
      })
      const boatId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        capacityModel: 'Pooled',
        totalUnits: 20,
        ownerId: 'boat-a',
        ownerType: 'Boat',
      })
      // Instructor fully booked, boat has 15/20
      await seedSnapshot(ctx, instrId, {
        date: testDate(5),
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedSnapshot(ctx, boatId, {
        date: testDate(5),
        totalUnits: 20,
        reservedUnits: 5,
        availableUnits: 15,
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      expect(result[instrId as string]?.[testDate(5)]).toEqual({ available: 0, total: 1 })
      expect(result[boatId as string]?.[testDate(5)]).toEqual({ available: 15, total: 20 })
    })
  })

  // ─── Blocked-date inventory exclusion ─────────────────────────────────────

  it('blocked owner returns available=0 for blocked date', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
      })
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.instructor,
        roleType: 'Instructor',
        dates: [testDate(5)],
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      expect(result[unitId as string]?.[testDate(5)]).toEqual({ available: 0, total: 1 })
    })
  })

  it('same unit returns normal capacity for non-blocked date', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
      })
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.instructor,
        roleType: 'Instructor',
        dates: [testDate(5)],
      })

      // Query a different date — not blocked
      const result = await _getCapacityForDates(ctx, [testDate(7)])
      expect(result[unitId as string]?.[testDate(7)]).toEqual({ available: 1, total: 1 })
    })
  })

  it('blocked Instructor role does not zero Equipment units for same owner', async () => {
    await t.run(async (ctx) => {
      // Same owner has both Instructor and Equipment inventory
      await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
      })
      const equipId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Equipment',
      })
      // Only Instructor role is blocked
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.instructor,
        roleType: 'Instructor',
        dates: [testDate(5)],
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      // Equipment capacity should be unaffected
      expect(result[equipId as string]?.[testDate(5)]).toEqual({ available: 10, total: 10 })
    })
  })

  it('unblocked owner unaffected by another owners block', async () => {
    await t.run(async (ctx) => {
      // Blocked instructor
      await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'blocked-instr',
      })
      await seedBlockedDates(ctx, {
        ownerSlug: 'blocked-instr',
        roleType: 'Instructor',
        dates: [testDate(5)],
      })
      // Unblocked instructor
      const unblockedId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'free-instr',
      })

      const result = await _getCapacityForDates(ctx, [testDate(5)])
      expect(result[unblockedId as string]?.[testDate(5)]).toEqual({ available: 1, total: 1 })
    })
  })
})

// ─── H4: Snapshot Window Matching ──────────────────────────────────────────

describe('H4 — Snapshot window matching via releaseBookingReservations', () => {
  it('H4-1: exact match succeeds — restore finds snapshot by unit/date/windowStart', async () => {
    const date = testDate(20)
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date,
        windowStart: '09:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date,
        startTime: '09:00',
        endTime: '17:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })

      // Release should find the exact snapshot and restore
      await releaseBookingReservations(ctx, bookingId, 'hold_expired')

      const snapshot = await ctx.db.get(snapshotId)
      expect(snapshot!.availableUnits).toBe(1)
      expect(snapshot!.reservedUnits).toBe(0)
    })
  })

  it('H4-2: date format mismatch — non-zero-padded vs zero-padded throws MISSING_SNAPSHOT', async () => {
    const date = testDate(20)
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      // Snapshot stored with zero-padded date
      await seedSnapshot(ctx, unitId, {
        date,
        windowStart: '09:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const bookingId = await seedBooking(ctx)
      // Session with non-zero-padded date — mismatch
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: malformedDate(date),
        startTime: '09:00',
        endTime: '17:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })

      // Should throw MISSING_SNAPSHOT because index lookup won't match
      await expect(
        releaseBookingReservations(ctx, bookingId, 'hold_expired'),
      ).rejects.toMatchObject({
        data: { code: 'MISSING_SNAPSHOT' },
      })
    })
  })

  it('H4-3: time format mismatch — "9:00" vs "09:00" throws VALIDATION error (DD-260)', async () => {
    const date = testDate(20)
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      // Snapshot stored with zero-padded time
      await seedSnapshot(ctx, unitId, {
        date,
        windowStart: '09:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const bookingId = await seedBooking(ctx)
      // Session with non-zero-padded time — now caught by assertValidTime (DD-260)
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date,
        startTime: '9:00',
        endTime: '17:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'PendingAcceptance' })

      // DD-260: assertValidTime rejects malformed "9:00" before the lookup
      await expect(
        releaseBookingReservations(ctx, bookingId, 'hold_expired'),
      ).rejects.toMatchObject({
        data: { code: 'VALIDATION' },
      })
    })
  })

  it('H4-4: multi-window same date — vacate morning only, afternoon unchanged', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })

      // Morning snapshot
      const morningSnapId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '12:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Afternoon snapshot (different booking holds this)
      const afternoonSnapId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '13:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Booking A: holds the morning slot
      const bookingA = await seedBooking(ctx)
      const sessionA = await seedSession(ctx, bookingA, unitId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '12:00',
      })
      await seedReservation(ctx, bookingA, unitId, sessionA, { status: 'PendingAcceptance' })

      // Release booking A — only morning session
      await releaseBookingReservations(ctx, bookingA, 'hold_expired')

      // Morning snapshot restored
      const morningSnap = await ctx.db.get(morningSnapId)
      expect(morningSnap!.availableUnits).toBe(1)
      expect(morningSnap!.reservedUnits).toBe(0)

      // Afternoon snapshot unchanged
      const afternoonSnap = await ctx.db.get(afternoonSnapId)
      expect(afternoonSnap!.availableUnits).toBe(0)
      expect(afternoonSnap!.reservedUnits).toBe(1)
    })
  })
})
