import { describe, it, expect, beforeEach } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import {
  _getUnavailableUnitIdsForDates,
  _listInventoryByType,
  _toggleBlockedDate,
} from '../convex/availability'
import { isFullDayResource } from '../convex/bookings/_shared'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
  seedBlockedDates,
} from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')
let t = convexTest(schema, modules)
beforeEach(() => {
  t = convexTest(schema, modules)
})

// ─── getUnavailableUnitIdsForDates ────────────────────────────────────────────

describe('_getUnavailableUnitIdsForDates', () => {
  it('returns empty set when no snapshots exist', async () => {
    await t.run(async (ctx) => {
      const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
      expect(result.size).toBe(0)
    })
  })

  it('returns empty set when all snapshots have availableUnits > 0', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx)
      await seedSnapshot(ctx, unitId, { totalUnits: 10, reservedUnits: 3, availableUnits: 7 })

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
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

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
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
        date: '2024-06-02',
        totalUnits: 10,
        reservedUnits: 10,
        availableUnits: 0,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-02'])
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

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
      expect(result.has(fullUnitId)).toBe(true)
      expect(result.has(availUnitId)).toBe(false)
    })
  })

  it('deduplicates unit IDs when unit is unavailable on multiple queried dates', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx)
      // Same unit fully booked on two different dates
      await seedSnapshot(ctx, unitId, {
        date: '2024-06-01',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedSnapshot(ctx, unitId, {
        date: '2024-06-02',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01', '2024-06-02'])
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

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
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

      const result = await _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' })

      expect(result).toBe(true)
      const doc = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_ownerSlug_roleType', (q: any) =>
          q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
        )
        .unique()
      expect(doc?.dates).toEqual(['2025-06-15'])
    })
  })

  it('unblocks a date that was previously blocked', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedBlockedDates(ctx, {
        ownerSlug: TEST_SLUGS.diveCenter,
        roleType: 'DiveCenter',
        dates: ['2025-06-15'],
      })

      const result = await _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' })

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
        dates: ['2025-06-15'],
      })

      // First call unblocks
      await _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' })
      // Second call blocks again
      const result = await _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' })

      expect(result).toBe(true)
    })
  })

  it('handles undefined blockedDates (first block ever)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const result = await _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' })

      expect(result).toBe(true)
      const doc = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_ownerSlug_roleType', (q: any) =>
          q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
        )
        .unique()
      expect(doc?.dates).toEqual(['2025-06-15'])
    })
  })

  it('throws UNAUTHENTICATED when identity is missing', async () => {
    await t.run(async (ctx) => {
      await expect(
        _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' }),
      ).rejects.toMatchObject({
        data: { code: 'UNAUTHENTICATED' },
      })
    })
  })

  it('throws NOT_FOUND when user record does not exist in Convex', async () => {
    // Identity present but no matching user in the DB
    await t.withIdentity({ tokenIdentifier: 'test|ghost-user' }).run(async (ctx) => {
      await expect(
        _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' }),
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
        dates: ['2025-06-10', '2025-06-20'],
      })

      await _toggleBlockedDate(ctx, { date: '2025-06-15', roleType: 'DiveCenter' })

      const doc = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_ownerSlug_roleType', (q: any) =>
          q.eq('ownerSlug', TEST_SLUGS.diveCenter).eq('roleType', 'DiveCenter'),
        )
        .unique()
      expect(doc?.dates).toEqual(['2025-06-10', '2025-06-20', '2025-06-15'])
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
        date: '2026-04-01',
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 2,
        reservedUnits: 1,
        availableUnits: 1,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2026-04-01'])
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
        date: '2026-04-01',
        windowStart: '08:00',
        windowEnd: '12:00',
        totalUnits: 3,
        reservedUnits: 1,
        availableUnits: 2,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2026-04-01'])
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
        date: '2026-04-01',
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2026-04-01'])
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
        date: '2026-04-01',
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 2,
        reservedUnits: 1,
        availableUnits: 1,
      })

      const result = await _getUnavailableUnitIdsForDates(ctx, ['2026-04-01'])
      // Time-window behavior: availableUnits > 0 → not unavailable
      expect(result.has(unitId)).toBe(false)
      // Confirm isFullDayResource respects the safe default
      expect(isFullDayResource({ resourceType: 'Boat' })).toBe(false)
    })
  })
})
