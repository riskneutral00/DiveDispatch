/**
 * venues.ts — DiveSite auto-inventory business logic tests.
 *
 * Tests the two pieces of business logic added by DD-368:
 * 1. venues.create auto-creates an inventoryUnit with Pooled capacity for DiveSite owners.
 * 2. Pool owners do NOT get an auto-created inventoryUnit (no regression).
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedDiveSiteUser(ctx: SeedCtx, slug: string) {
  return seedUser(ctx, {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    role: 'DiveSite',
  })
}

async function seedPoolUser(ctx: SeedCtx, slug: string) {
  return seedUser(ctx, {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    role: 'Pool',
  })
}

const VALID_DIVE_SITE_ARGS = {
  name: 'Shark Bay Reef',
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.09,
  lng: 99.84,
  venueCategory: 'diveSite' as const,
  diveSiteTypes: ['reef' as const],
  confinedCapable: false,
  hasCompressor: false,
  maxCapacity: 20,
}

const VALID_POOL_ARGS = {
  name: 'Sairee Training Pool',
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.09,
  lng: 99.84,
  venueCategory: 'pool' as const,
  hasCompressor: false,
  maxCapacity: 15,
  maxDepth: 5,
}

// ── venues.create — DiveSite auto-inventory ────────────────────────────────────

describe('venues.create — DiveSite auto-inventory', () => {
  it('auto-creates an inventoryUnit when DiveSite user creates venue', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedDiveSiteUser(ctx, 'site-owner') })

    await t.withIdentity({ tokenIdentifier: 'clerk|site-owner' })
      .mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'site-owner').eq('ownerType', 'DiveSite'),
        )
        .collect()

      expect(units).toHaveLength(1)
      expect(units[0].resourceType).toBe('DiveSite')
      expect(units[0].capacityModel).toBe('Pooled')
      expect(units[0].totalUnits).toBe(20)
      expect(units[0].ownerId).toBe('site-owner')
      expect(units[0].ownerType).toBe('DiveSite')
      expect(units[0].displayName).toBe('Shark Bay Reef')
      expect(units[0].resourceId).toBe('site-owner')
    })
  })

  it('inventoryUnit totalUnits matches maxCapacity', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedDiveSiteUser(ctx, 'cap-test') })

    await t.withIdentity({ tokenIdentifier: 'clerk|cap-test' })
      .mutation(api.venues.create, { ...VALID_DIVE_SITE_ARGS, maxCapacity: 50 })

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'cap-test').eq('ownerType', 'DiveSite'),
        )
        .collect()

      expect(units[0].totalUnits).toBe(50)
    })
  })

  it('does NOT create duplicate inventoryUnit when venue already exists (returns existing ID)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedDiveSiteUser(ctx, 'dup-site') })
    const identity = { tokenIdentifier: 'clerk|dup-site' }

    // First create
    await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)
    // Second create returns existing id without re-inserting
    await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'dup-site').eq('ownerType', 'DiveSite'),
        )
        .collect()

      expect(units).toHaveLength(1)
    })
  })

  it('uses unbounded sentinel when maxCapacity is omitted (uncapped DiveSite)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedDiveSiteUser(ctx, 'no-cap') })

    const { maxCapacity: _omit, ...argsWithoutCapacity } = VALID_DIVE_SITE_ARGS
    await t.withIdentity({ tokenIdentifier: 'clerk|no-cap' })
      .mutation(api.venues.create, argsWithoutCapacity)

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'no-cap').eq('ownerType', 'DiveSite'),
        )
        .collect()

      expect(units).toHaveLength(1)
      expect(units[0].totalUnits).toBe(999999)
    })
  })

  it('auto-creates a Pool inventoryUnit when Pool user creates venue', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-owner') })

    await t.withIdentity({ tokenIdentifier: 'clerk|pool-owner' })
      .mutation(api.venues.create, VALID_POOL_ARGS)

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'pool-owner').eq('ownerType', 'Pool'),
        )
        .collect()

      expect(units).toHaveLength(1)
      expect(units[0].resourceType).toBe('Pool')
      expect(units[0].capacityModel).toBe('Pooled')
      expect(units[0].totalUnits).toBe(15)
      expect(units[0].displayName).toBe('Sairee Training Pool')
    })
  })

  it('Pool create without maxCapacity uses 999999 sentinel', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-no-cap') })

    const { maxCapacity: _omit, ...argsWithoutCapacity } = VALID_POOL_ARGS
    await t.withIdentity({ tokenIdentifier: 'clerk|pool-no-cap' })
      .mutation(api.venues.create, argsWithoutCapacity)

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'pool-no-cap').eq('ownerType', 'Pool'),
        )
        .collect()

      expect(units).toHaveLength(1)
      expect(units[0].totalUnits).toBe(999999)
    })
  })

  it('still inserts the venue row for DiveSite', async () => {
    const t = makeT()
    let userId: Id<'users'> | undefined
    await t.run(async (ctx) => {
      userId = await seedDiveSiteUser(ctx, 'venue-check')
    })

    const venueId = await t.withIdentity({ tokenIdentifier: 'clerk|venue-check' })
      .mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    await t.run(async (ctx) => {
      const venue = await ctx.db.get(venueId as Id<'venues'>) as Doc<'venues'> | null
      expect(venue).not.toBeNull()
      expect(venue!.name).toBe('Shark Bay Reef')
      expect(venue!.venueCategory).toBe('diveSite')
      expect(venue!.diveSiteTypes).toEqual(['reef'])
      expect(venue!.userId).toEqual(userId)
    })
  })
})

describe('venues.create — Pool vs DiveSite invariants', () => {
  it('rejects DiveSite user submitting venueCategory: pool', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedDiveSiteUser(ctx, 'ds-wrong-cat') })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|ds-wrong-cat' })
        .mutation(api.venues.create, { ...VALID_POOL_ARGS, name: 'Misdeclared' }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('rejects Pool payload with diveSiteTypes', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-bad-types') })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|pool-bad-types' })
        .mutation(api.venues.create, {
          ...VALID_POOL_ARGS,
          diveSiteTypes: ['reef' as const],
        }),
    ).rejects.toThrow(/INVALID_INPUT/)
  })

  it('rejects Pool payload with confinedCapable', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-bad-confined') })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|pool-bad-confined' })
        .mutation(api.venues.create, {
          ...VALID_POOL_ARGS,
          confinedCapable: true,
        }),
    ).rejects.toThrow(/INVALID_INPUT/)
  })

  it('rejects DiveSite payload with empty diveSiteTypes', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedDiveSiteUser(ctx, 'ds-empty') })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|ds-empty' })
        .mutation(api.venues.create, {
          ...VALID_DIVE_SITE_ARGS,
          diveSiteTypes: [],
        }),
    ).rejects.toThrow(/INVALID_INPUT/)
  })

  it('persists Pool without confinedCapable field', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-clean') })

    const venueId = await t.withIdentity({ tokenIdentifier: 'clerk|pool-clean' })
      .mutation(api.venues.create, VALID_POOL_ARGS)

    await t.run(async (ctx) => {
      const venue = await ctx.db.get(venueId as Id<'venues'>) as Doc<'venues'> | null
      expect(venue!.venueCategory).toBe('pool')
      expect(venue!.confinedCapable).toBeUndefined()
      expect(venue!.diveSiteTypes).toBeUndefined()
    })
  })

})

// ── venues.update — inventoryUnit totalUnits sync ─────────────────────────────

describe('venues.update — capacity sync to inventoryUnit', () => {
  it('syncs inventoryUnit.totalUnits when DiveSite maxCapacity changes', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedDiveSiteUser(ctx, 'ds-cap-change') })
    const identity = { tokenIdentifier: 'clerk|ds-cap-change' }

    await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)
    await t.withIdentity(identity).mutation(api.venues.update, { maxCapacity: 35 })

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'ds-cap-change').eq('ownerType', 'DiveSite'),
        )
        .collect()
      expect(units[0].totalUnits).toBe(35)
    })
  })

  it('syncs inventoryUnit.totalUnits when Pool maxCapacity changes', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-cap-change') })
    const identity = { tokenIdentifier: 'clerk|pool-cap-change' }

    await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    await t.withIdentity(identity).mutation(api.venues.update, { maxCapacity: 42 })

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'pool-cap-change').eq('ownerType', 'Pool'),
        )
        .collect()
      expect(units[0].totalUnits).toBe(42)
    })
  })

  it('leaves inventoryUnit untouched when update omits maxCapacity', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-no-update') })
    const identity = { tokenIdentifier: 'clerk|pool-no-update' }

    await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    await t.withIdentity(identity).mutation(api.venues.update, { name: 'Renamed Pool' })

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'pool-no-update').eq('ownerType', 'Pool'),
        )
        .collect()
      expect(units[0].totalUnits).toBe(15)
    })
  })
})

// ── venues.create — access control (unchanged invariants) ─────────────────────

describe('venues.create — access control', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.venues.create, VALID_DIVE_SITE_ARGS),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects callers without Pool or DiveSite role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-user',
        slug: 'dc-user',
        email: 'dc@test.com',
        name: 'DC User',
        firstName: 'DC',
        lastName: 'User',
        role: 'DiveCenter',
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-user' })
        .mutation(api.venues.create, VALID_DIVE_SITE_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})
