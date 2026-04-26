/**
 * DD-301: gearSizingLookup CRUD mutations for equipment managers.
 *
 * Tests createSizingEntry, updateSizingEntry, removeSizingEntry, and
 * listByManufacturer covering: happy paths, auth/role enforcement,
 * duplicate guard, and range validation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { TEST_TOKENS, TEST_SLUGS, seedUser } from './fixtures'

const EM_TOKEN = 'test|em-user'
const EM_SLUG = TEST_SLUGS.em

// ── createSizingEntry ────────────────────────────────────────────────────────────

describe('gearSizingLookup.createSizingEntry', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('inserts a new gearSizingLookup row and returns the id', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'wetsuit',
        size: 'M',
        minHeight: 165,
        maxHeight: 180,
        minWeight: 60,
        maxWeight: 85,
      },
    )

    await t.run(async (ctx) => {
      const entry = await ctx.db.get(entryId as Id<'gearSizingLookup'>)
      expect(entry).not.toBeNull()
      expect(entry!.manufacturer).toBe('TestBrand')
      expect(entry!.gearType).toBe('wetsuit')
      expect(entry!.size).toBe('M')
      expect(entry!.minHeight).toBe(165)
      expect(entry!.maxHeight).toBe(180)
      expect(entry!.minWeight).toBe(60)
      expect(entry!.maxWeight).toBe(85)
    })
  })

  it('inserts a fin entry with shoeSize and shoeSizeUnit', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'fins',
        size: 'M',
        minHeight: 0,
        maxHeight: 999,
        minWeight: 0,
        maxWeight: 999,
        shoeSize: 42,
        shoeSizeUnit: 'EU',
      },
    )

    await t.run(async (ctx) => {
      const entry = await ctx.db.get(entryId as Id<'gearSizingLookup'>)
      expect(entry!.shoeSize).toBe(42)
      expect(entry!.shoeSizeUnit).toBe('EU')
    })
  })

  it('rejects when caller lacks Equipment role', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.diveCenter, slug: TEST_SLUGS.diveCenter, role: 'DiveCenter' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).mutation(
        api.gearSizingLookup.createSizingEntry,
        {
          manufacturer: 'TestBrand',
          gearType: 'wetsuit',
          size: 'L',
          minHeight: 170,
          maxHeight: 185,
          minWeight: 70,
          maxWeight: 90,
        },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects unauthenticated caller', async () => {
    await expectConvexError(
      t.mutation(api.gearSizingLookup.createSizingEntry, {
        manufacturer: 'TestBrand',
        gearType: 'bcd',
        size: 'S',
        minHeight: 155,
        maxHeight: 170,
        minWeight: 50,
        maxWeight: 70,
      }),
      'UNAUTHENTICATED',
    )
  })

  it('rejects duplicate manufacturer + gearType + size', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'bcd',
        size: 'M',
        minHeight: 160,
        maxHeight: 180,
        minWeight: 60,
        maxWeight: 85,
      },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.createSizingEntry,
        {
          manufacturer: 'TestBrand',
          gearType: 'bcd',
          size: 'M',
          minHeight: 162,
          maxHeight: 182,
          minWeight: 62,
          maxWeight: 87,
        },
      ),
      'CONFLICT',
    )
  })

  it('rejects when minHeight >= maxHeight', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.createSizingEntry,
        {
          manufacturer: 'TestBrand',
          gearType: 'wetsuit',
          size: 'L',
          minHeight: 180,
          maxHeight: 170,
          minWeight: 60,
          maxWeight: 80,
        },
      ),
      'VALIDATION',
    )
  })

  it('rejects when minWeight >= maxWeight', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.createSizingEntry,
        {
          manufacturer: 'TestBrand',
          gearType: 'bcd',
          size: 'XL',
          minHeight: 180,
          maxHeight: 195,
          minWeight: 90,
          maxWeight: 80,
        },
      ),
      'VALIDATION',
    )
  })

  it('rejects negative minHeight', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.createSizingEntry,
        {
          manufacturer: 'TestBrand',
          gearType: 'wetsuit',
          size: 'S',
          minHeight: -10,
          maxHeight: 170,
          minWeight: 50,
          maxWeight: 75,
        },
      ),
      'VALIDATION',
    )
  })

  it('rejects negative minWeight', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.createSizingEntry,
        {
          manufacturer: 'TestBrand',
          gearType: 'wetsuit',
          size: 'S',
          minHeight: 155,
          maxHeight: 170,
          minWeight: -5,
          maxWeight: 70,
        },
      ),
      'VALIDATION',
    )
  })
})

// ── updateSizingEntry ─────────────────────────────────────────────────────────

describe('gearSizingLookup.updateSizingEntry', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('patches specified fields on the entry', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'bcd',
        size: 'M',
        minHeight: 160,
        maxHeight: 180,
        minWeight: 60,
        maxWeight: 85,
      },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.updateSizingEntry,
      {
        entryId: entryId as Id<'gearSizingLookup'>,
        minHeight: 162,
        maxHeight: 182,
      },
    )

    await t.run(async (ctx) => {
      const entry = await ctx.db.get(entryId as Id<'gearSizingLookup'>)
      expect(entry!.minHeight).toBe(162)
      expect(entry!.maxHeight).toBe(182)
      // Unchanged fields remain
      expect(entry!.minWeight).toBe(60)
      expect(entry!.maxWeight).toBe(85)
    })
  })

  it('rejects when caller lacks Equipment role', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.diveCenter, slug: TEST_SLUGS.diveCenter, role: 'DiveCenter' })
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'wetsuit',
        size: 'S',
        minHeight: 155,
        maxHeight: 170,
        minWeight: 50,
        maxWeight: 70,
      },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).mutation(
        api.gearSizingLookup.updateSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'>, minHeight: 160 },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects NOT_FOUND for nonexistent entry', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    // Create and delete to get a stale id
    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'bcd',
        size: 'XS',
        minHeight: 150,
        maxHeight: 165,
        minWeight: 45,
        maxWeight: 60,
      },
    )
    await t.run(async (ctx) => { await ctx.db.delete(entryId as Id<'gearSizingLookup'>) })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.updateSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'>, minHeight: 152 },
      ),
      'NOT_FOUND',
    )
  })

  it('rejects when updated minHeight >= maxHeight', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'wetsuit',
        size: 'L',
        minHeight: 170,
        maxHeight: 185,
        minWeight: 70,
        maxWeight: 90,
      },
    )

    // Try to set minHeight above maxHeight
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.updateSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'>, minHeight: 190 },
      ),
      'VALIDATION',
    )
  })

  it('rejects when updated minWeight >= maxWeight', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'bcd',
        size: 'M',
        minHeight: 160,
        maxHeight: 180,
        minWeight: 60,
        maxWeight: 85,
      },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.updateSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'>, minWeight: 100 },
      ),
      'VALIDATION',
    )
  })

  it('rejects when renaming size would create a duplicate', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    // Insert two entries: M and L for the same manufacturer + gearType
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'TestBrand', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 60, maxWeight: 80 },
    )
    const entryL = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'TestBrand', gearType: 'wetsuit', size: 'L', minHeight: 175, maxHeight: 190, minWeight: 75, maxWeight: 95 },
    )

    // Attempt to rename L → M (conflicts with the existing M entry)
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.updateSizingEntry,
        { entryId: entryL as Id<'gearSizingLookup'>, size: 'M' },
      ),
      'CONFLICT',
    )
  })

  it('allows renaming size to a value that does not conflict', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'TestBrand', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 60, maxWeight: 80 },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.updateSizingEntry,
      { entryId: entryId as Id<'gearSizingLookup'>, size: 'XL' },
    )

    await t.run(async (ctx) => {
      const entry = await ctx.db.get(entryId as Id<'gearSizingLookup'>)
      expect(entry!.size).toBe('XL')
    })
  })

  it('rejects unauthenticated caller', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'TestBrand', gearType: 'bcd', size: 'S', minHeight: 155, maxHeight: 170, minWeight: 50, maxWeight: 70 },
    )

    await expectConvexError(
      t.mutation(
        api.gearSizingLookup.updateSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'>, minHeight: 157 },
      ),
      'UNAUTHENTICATED',
    )
  })
})

// ── removeSizingEntry ─────────────────────────────────────────────────────────

describe('gearSizingLookup.removeSizingEntry', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('deletes the gearSizingLookup row', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'bcd',
        size: 'S',
        minHeight: 157,
        maxHeight: 170,
        minWeight: 54,
        maxWeight: 70,
      },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.removeSizingEntry,
      { entryId: entryId as Id<'gearSizingLookup'> },
    )

    await t.run(async (ctx) => {
      const entry = await ctx.db.get(entryId as Id<'gearSizingLookup'>)
      expect(entry).toBeNull()
    })
  })

  it('rejects when caller lacks Equipment role', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.diveCenter, slug: TEST_SLUGS.diveCenter, role: 'DiveCenter' })
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'fins',
        size: 'L',
        minHeight: 0,
        maxHeight: 999,
        minWeight: 0,
        maxWeight: 999,
      },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).mutation(
        api.gearSizingLookup.removeSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'> },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects NOT_FOUND for nonexistent entry', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'mask',
        size: 'OneSize',
        minHeight: 0,
        maxHeight: 999,
        minWeight: 0,
        maxWeight: 999,
      },
    )
    await t.run(async (ctx) => { await ctx.db.delete(entryId as Id<'gearSizingLookup'>) })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.gearSizingLookup.removeSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'> },
      ),
      'NOT_FOUND',
    )
  })

  it('rejects unauthenticated caller', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      {
        manufacturer: 'TestBrand',
        gearType: 'regulator',
        size: 'S',
        minHeight: 0,
        maxHeight: 999,
        minWeight: 0,
        maxWeight: 999,
      },
    )

    await expectConvexError(
      t.mutation(
        api.gearSizingLookup.removeSizingEntry,
        { entryId: entryId as Id<'gearSizingLookup'> },
      ),
      'UNAUTHENTICATED',
    )
  })
})

// ── listByManufacturer ────────────────────────────────────────────────────────

describe('gearSizingLookup.listByManufacturer', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('returns all entries for a manufacturer sorted by size', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    // Insert in reverse order to verify sorting
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'BrandA', gearType: 'wetsuit', size: 'XL', minHeight: 180, maxHeight: 195, minWeight: 80, maxWeight: 100 },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'BrandA', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 60, maxWeight: 80 },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'BrandA', gearType: 'wetsuit', size: 'S', minHeight: 155, maxHeight: 170, minWeight: 50, maxWeight: 70 },
    )

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.gearSizingLookup.listByManufacturer,
      { manufacturer: 'BrandA' },
    )

    expect(result).toHaveLength(3)
    // Sorted by size (ascending alpha)
    expect(result[0].size).toBe('M')
    expect(result[1].size).toBe('S')
    expect(result[2].size).toBe('XL')
  })

  it('filters by gearType when provided', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'BrandA', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 60, maxWeight: 80 },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'BrandA', gearType: 'bcd', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 60, maxWeight: 80 },
    )

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.gearSizingLookup.listByManufacturer,
      { manufacturer: 'BrandA', gearType: 'wetsuit' },
    )

    expect(result).toHaveLength(1)
    expect(result[0].gearType).toBe('wetsuit')
  })

  it('returns empty array when no entries match', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.gearSizingLookup.listByManufacturer,
      { manufacturer: 'UnknownBrand' },
    )

    expect(result).toEqual([])
  })

  it('does not mix entries across manufacturers', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'BrandA', gearType: 'bcd', size: 'S', minHeight: 155, maxHeight: 170, minWeight: 50, maxWeight: 70 },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'BrandB', gearType: 'bcd', size: 'L', minHeight: 175, maxHeight: 190, minWeight: 80, maxWeight: 100 },
    )

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.gearSizingLookup.listByManufacturer,
      { manufacturer: 'BrandA' },
    )

    expect(result).toHaveLength(1)
    expect(result[0].manufacturer).toBe('BrandA')
  })

  it('rejects unauthenticated caller', async () => {
    await expectConvexError(
      t.query(api.gearSizingLookup.listByManufacturer, { manufacturer: 'BrandA' }),
      'UNAUTHENTICATED',
    )
  })
})

const EM_TOKEN_B = 'test|em-user-b'
const EM_SLUG_B = 'em-slug-b'

describe('gearSizingLookup ownership', () => {
  let t: ReturnType<typeof makeT>
  let entryId: Id<'gearSizingLookup'>

  beforeEach(async () => {
    t = makeT()
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })
    await t.withIdentity({ tokenIdentifier: EM_TOKEN_B }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN_B, slug: EM_SLUG_B, role: 'Equipment', email: 'em-b@test.com' })
    })
    entryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.createSizingEntry,
      { manufacturer: 'OwnerBrand', gearType: 'wetsuit', size: 'M', minHeight: 165, maxHeight: 180, minWeight: 60, maxWeight: 85 },
    ) as Id<'gearSizingLookup'>
  })

  it('stores createdBy on insert', async () => {
    await t.run(async (ctx) => {
      const entry = await ctx.db.get(entryId)
      expect(entry!.createdBy).toBe(EM_SLUG)
    })
  })

  it('blocks updateSizingEntry by non-owner', async () => {
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN_B }).mutation(
        api.gearSizingLookup.updateSizingEntry,
        { entryId, size: 'L' },
      ),
      'FORBIDDEN',
    )
  })

  it('blocks removeSizingEntry by non-owner', async () => {
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN_B }).mutation(
        api.gearSizingLookup.removeSizingEntry,
        { entryId },
      ),
      'FORBIDDEN',
    )
  })

  it('allows owner to update own entry', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.gearSizingLookup.updateSizingEntry,
      { entryId, size: 'L' },
    )
    await t.run(async (ctx) => {
      const entry = await ctx.db.get(entryId)
      expect(entry!.size).toBe('L')
    })
  })
})
