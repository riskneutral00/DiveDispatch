import { describe, it, expect, beforeEach } from 'vitest'
import {
  TEST_TOKENS,
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
} from './fixtures/seedFixture'
import { testDate } from './helpers/dates'
import type { Id } from '../convex/_generated/dataModel'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

const EMPTY_SLUGS = { instructor: [] as string[], venue: [] as string[], boat: [] as string[], equipment: [] as string[], compressor: [] as string[] }

// Helper to run the checkPreferredAvailability logic inside t.run()
// Mirrors the query handler but avoids needing a function reference
async function checkAvailability(
  ctx: { db: any },
  args: { dates: string[]; preferredSlugs: typeof EMPTY_SLUGS },
): Promise<Record<string, { slug: string; available: boolean }[]>> {
  if (args.dates.length === 0) return {}

  const allSlugs = [
    ...args.preferredSlugs.instructor,
    ...args.preferredSlugs.venue,
    ...args.preferredSlugs.boat,
    ...args.preferredSlugs.equipment,
    ...args.preferredSlugs.compressor,
  ]
  if (allSlugs.length === 0) return {}

  // Resolve slugs → inventory units
  const unitsBySlug = new Map<string, { _id: string; totalUnits: number }>()
  await Promise.all(
    allSlugs.map(async (slug) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_resourceId', (q: any) => q.eq('resourceId', slug))
        .collect()
      if (units[0]) {
        unitsBySlug.set(slug, { _id: units[0]._id, totalUnits: units[0].totalUnits })
      }
    }),
  )

  // Fetch snapshots
  const allSnapshots = await Promise.all(
    args.dates.map((date) =>
      ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_date', (q: any) => q.eq('date', date))
        .collect(),
    ),
  )

  const unavailable = new Set<string>()
  for (const snapshots of allSnapshots) {
    for (const snap of snapshots) {
      if (snap.availableUnits <= 0) {
        unavailable.add(snap.inventoryUnitId)
      }
    }
  }

  function checkSlugs(slugs: string[]): { slug: string; available: boolean }[] {
    return slugs.map((slug) => {
      const unit = unitsBySlug.get(slug)
      if (!unit) return { slug, available: true }
      return { slug, available: !unavailable.has(unit._id) }
    })
  }

  return {
    instructor: checkSlugs(args.preferredSlugs.instructor),
    venue: checkSlugs(args.preferredSlugs.venue),
    boat: checkSlugs(args.preferredSlugs.boat),
    equipment: checkSlugs(args.preferredSlugs.equipment),
    compressor: checkSlugs(args.preferredSlugs.compressor),
  }
}

describe('checkPreferredAvailability', () => {
  it('returns empty object when dates array is empty', async () => {
    await t.run(async (ctx) => {
      const result = await checkAvailability(ctx, { dates: [], preferredSlugs: EMPTY_SLUGS })
      expect(result).toEqual({})
    })
  })

  it('returns empty object when all slug arrays are empty', async () => {
    await t.run(async (ctx) => {
      const result = await checkAvailability(ctx, { dates: [testDate(5)], preferredSlugs: EMPTY_SLUGS })
      expect(result).toEqual({})
    })
  })

  it('returns available=true when no snapshots exist (lazy init)', async () => {
    await t.run(async (ctx) => {
      await seedInventoryUnit(ctx, { ownerId: 'instr-1', resourceType: 'Instructor' })
      const result = await checkAvailability(ctx, {
        dates: [testDate(5)],
        preferredSlugs: { ...EMPTY_SLUGS, instructor: ['instr-1'] },
      })
      expect(result.instructor).toEqual([{ slug: 'instr-1', available: true }])
    })
  })

  it('returns available=false when inventory unit has zero capacity', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instr-booked',
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
      const result = await checkAvailability(ctx, {
        dates: [testDate(5)],
        preferredSlugs: { ...EMPTY_SLUGS, instructor: ['instr-booked'] },
      })
      expect(result.instructor).toEqual([{ slug: 'instr-booked', available: false }])
    })
  })

  it('returns available=true for slugs with remaining capacity', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'equip-1',
        resourceType: 'Equipment',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        totalUnits: 10,
        reservedUnits: 3,
        availableUnits: 7,
      })
      const result = await checkAvailability(ctx, {
        dates: [testDate(5)],
        preferredSlugs: { ...EMPTY_SLUGS, equipment: ['equip-1'] },
      })
      expect(result.equipment).toEqual([{ slug: 'equip-1', available: true }])
    })
  })

  it('returns available=true for slugs with no inventory unit (external)', async () => {
    await t.run(async (ctx) => {
      const result = await checkAvailability(ctx, {
        dates: [testDate(5)],
        preferredSlugs: { ...EMPTY_SLUGS, instructor: ['external-instr'] },
      })
      expect(result.instructor).toEqual([{ slug: 'external-instr', available: true }])
    })
  })

  it('unavailable on any date in range marks unavailable', async () => {
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instr-partial',
        resourceType: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })
      await seedSnapshot(ctx, unitId, {
        date: testDate(6),
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      const result = await checkAvailability(ctx, {
        dates: [testDate(5), testDate(6)],
        preferredSlugs: { ...EMPTY_SLUGS, instructor: ['instr-partial'] },
      })
      expect(result.instructor).toEqual([{ slug: 'instr-partial', available: false }])
    })
  })
})
