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
  venueType: 'Shore' as const,
  isPublic: false,
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
  venueType: 'Pool' as const,
  isPublic: false,
  confinedCapable: true,
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

  it('defaults totalUnits to 1 when maxCapacity is omitted (onboarding path)', async () => {
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
      expect(units[0].totalUnits).toBeGreaterThanOrEqual(1)
    })
  })

  it('does NOT create an inventoryUnit when Pool user creates venue', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedPoolUser(ctx, 'pool-owner') })

    await t.withIdentity({ tokenIdentifier: 'clerk|pool-owner' })
      .mutation(api.venues.create, VALID_POOL_ARGS)

    await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'pool-owner').eq('ownerType', 'DiveSite'),
        )
        .collect()

      expect(units).toHaveLength(0)
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
      expect(venue!.venueType).toBe('Shore')
      expect(venue!.userId).toEqual(userId)
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
