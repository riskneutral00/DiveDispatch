import { describe, it, expect, vi } from 'vitest'

vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
  internalQuery: (config: unknown) => config,
}))

import {
  _getUnavailableUnitIdsForDates,
  _listInventoryByType,
} from '../convex/availability'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER = {
  _id: 'u1',
  slug: 'owner-slug',
  businessName: 'Blue Ocean Dive',
  role: 'Instructor',
}

const UNIT_EXCLUSIVE: Record<string, unknown> = {
  _id: 'unit1',
  resourceType: 'Instructor',
  ownerType: 'Instructor',
  ownerId: 'owner-slug',
  displayName: 'John Doe',
  capacityModel: 'Exclusive',
  totalUnits: 1,
}

const UNIT_POOLED: Record<string, unknown> = {
  _id: 'unit2',
  resourceType: 'Equipment',
  ownerType: 'Equipment',
  ownerId: 'owner-slug',
  displayName: 'BCD Set',
  capacityModel: 'Pooled',
  totalUnits: 10,
}

const SNAP_FULL = {
  _id: 'snap1',
  inventoryUnitId: 'unit1',
  date: '2024-06-01',
  windowStart: '08:00',
  windowEnd: '16:00',
  totalUnits: 1,
  reservedUnits: 1,
  availableUnits: 0,
}

const SNAP_AVAILABLE = {
  _id: 'snap2',
  inventoryUnitId: 'unit2',
  date: '2024-06-01',
  windowStart: '08:00',
  windowEnd: '16:00',
  totalUnits: 10,
  reservedUnits: 3,
  availableUnits: 7,
}

const SNAP_POOLED_FULL = {
  _id: 'snap3',
  inventoryUnitId: 'unit2',
  date: '2024-06-02',
  windowStart: '08:00',
  windowEnd: '16:00',
  totalUnits: 10,
  reservedUnits: 10,
  availableUnits: 0,
}

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeCtx({
  snapshots = [] as unknown[],
  inventoryUnits = [] as unknown[],
  ownerUser = OWNER as unknown | null,
} = {}) {
  return {
    db: {
      query: vi.fn().mockImplementation((table: string) => {
        let collectResult: unknown[] = []
        let uniqueResult: unknown = null

        if (table === 'availabilitySnapshots') {
          collectResult = snapshots
        } else if (table === 'inventoryUnits') {
          collectResult = inventoryUnits
        } else if (table === 'users') {
          uniqueResult = ownerUser
        }

        const chain = {
          withIndex: vi.fn(),
          filter: vi.fn(),
          collect: vi.fn().mockResolvedValue(collectResult),
          unique: vi.fn().mockResolvedValue(uniqueResult),
          first: vi.fn().mockResolvedValue(uniqueResult ?? collectResult[0] ?? null),
        }
        chain.withIndex.mockReturnValue(chain)
        chain.filter.mockReturnValue(chain)
        return chain
      }),
    },
  }
}

// ─── getUnavailableUnitIdsForDates ────────────────────────────────────────────

describe('_getUnavailableUnitIdsForDates', () => {
  it('returns empty set when no snapshots exist', async () => {
    const ctx = makeCtx({ snapshots: [] })
    const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
    expect(result.size).toBe(0)
  })

  it('returns empty set when all snapshots have availableUnits > 0', async () => {
    const ctx = makeCtx({ snapshots: [SNAP_AVAILABLE] })
    const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
    expect(result.size).toBe(0)
  })

  it('includes unit when Exclusive snapshot has availableUnits === 0', async () => {
    const ctx = makeCtx({ snapshots: [SNAP_FULL] })
    const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
    expect(result.has('unit1')).toBe(true)
  })

  it('includes unit when Pooled snapshot has availableUnits === 0', async () => {
    const ctx = makeCtx({ snapshots: [SNAP_POOLED_FULL] })
    const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-02'])
    expect(result.has('unit2')).toBe(true)
  })

  it('does not include unit where availableUnits > 0', async () => {
    const ctx = makeCtx({ snapshots: [SNAP_FULL, SNAP_AVAILABLE] })
    const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
    expect(result.has('unit1')).toBe(true)
    expect(result.has('unit2')).toBe(false)
  })

  it('deduplicates unit IDs when querying multiple dates', async () => {
    // unit1 appears fully booked on both dates — should only appear once in Set
    const ctx = makeCtx({ snapshots: [SNAP_FULL] })
    const result = await _getUnavailableUnitIdsForDates(ctx, [
      '2024-06-01',
      '2024-06-02',
    ])
    expect(result.size).toBe(1)
    expect(result.has('unit1')).toBe(true)
  })

  it('returns empty set when dates array is empty', async () => {
    const ctx = makeCtx({ snapshots: [SNAP_FULL] })
    const result = await _getUnavailableUnitIdsForDates(ctx, [])
    expect(result.size).toBe(0)
  })

  it('marks unit unavailable when any window has availableUnits === 0', async () => {
    // One window available, one full — unit should still be flagged
    const partiallyFull = {
      ...SNAP_AVAILABLE,
      _id: 'snap-partial',
      inventoryUnitId: 'unit2',
      availableUnits: 0,
    }
    const ctx = makeCtx({ snapshots: [SNAP_AVAILABLE, partiallyFull] })
    const result = await _getUnavailableUnitIdsForDates(ctx, ['2024-06-01'])
    expect(result.has('unit2')).toBe(true)
  })
})

// ─── listInventoryByType ──────────────────────────────────────────────────────

describe('_listInventoryByType', () => {
  it('returns all units of a given type with joined ownerName', async () => {
    const ctx = makeCtx({ inventoryUnits: [UNIT_EXCLUSIVE] })
    const result = await _listInventoryByType(ctx, { type: 'Instructor' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'unit1',
      name: 'John Doe',
      type: 'Instructor',
      ownerId: 'owner-slug',
      ownerName: 'Blue Ocean Dive',
    })
  })

  it('returns empty array when no units of that type exist', async () => {
    const ctx = makeCtx({ inventoryUnits: [] })
    const result = await _listInventoryByType(ctx, { type: 'Boat' })
    expect(result).toHaveLength(0)
  })

  it('filters to ownerSlug when provided', async () => {
    const otherUnit = { ...UNIT_EXCLUSIVE, _id: 'unit9', ownerId: 'other-slug' }
    const ctx = makeCtx({ inventoryUnits: [UNIT_EXCLUSIVE, otherUnit] })

    const result = await _listInventoryByType(ctx, {
      type: 'Instructor',
      ownerSlug: 'owner-slug',
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('unit1')
  })

  it('returns all units when ownerSlug is not provided', async () => {
    const otherUnit = {
      ...UNIT_EXCLUSIVE,
      _id: 'unit9',
      ownerId: 'other-slug',
      displayName: 'Jane Smith',
    }
    const ctx = makeCtx({ inventoryUnits: [UNIT_EXCLUSIVE, otherUnit] })

    const result = await _listInventoryByType(ctx, { type: 'Instructor' })

    expect(result).toHaveLength(2)
  })

  it('falls back to displayName when owner user is not found', async () => {
    const ctx = makeCtx({ inventoryUnits: [UNIT_EXCLUSIVE], ownerUser: null })
    const result = await _listInventoryByType(ctx, { type: 'Instructor' })

    expect(result[0].ownerName).toBe('John Doe')
  })

  it('returns correct shape for Pooled resource type', async () => {
    const ctx = makeCtx({ inventoryUnits: [UNIT_POOLED] })
    const result = await _listInventoryByType(ctx, { type: 'Equipment' })

    expect(result[0]).toMatchObject({
      id: 'unit2',
      name: 'BCD Set',
      type: 'Equipment',
      ownerId: 'owner-slug',
      ownerName: 'Blue Ocean Dive',
    })
  })

  it('does not expose booking or reservation data', async () => {
    const ctx = makeCtx({ inventoryUnits: [UNIT_EXCLUSIVE] })
    const result = await _listInventoryByType(ctx, { type: 'Instructor' })

    // Result shape must not contain booking-related fields
    const item = result[0]
    expect(item).not.toHaveProperty('bookingId')
    expect(item).not.toHaveProperty('reservedUnits')
    expect(item).not.toHaveProperty('availableUnits')
  })
})
