/**
 * venues.ts — multi-row multi-venue business logic tests.
 *
 * Covers:
 *   1. venues.create mints a unique per-row slug + auto-creates inventoryUnit keyed on venue.slug.
 *   2. Creating multiple venues under one org — .unique() gone; no idempotency collapse.
 *   3. venues.update by venueId patches the correct row; capacity sync updates the right inventoryUnit.
 *   4. venues.remove deletes the row AND its inventoryUnit.
 *   5. venues.mine returns an array of all venues for the active org (not a single doc).
 *   6. venues.bySlug resolves across operators for cross-DC bookability.
 *   7. accessControlFields (isAllowed / notAllowed) persisted per venue row.
 *   8. FORBIDDEN on update/remove for venues owned by a different organization.
 *   9. Non-Venue-role callers rejected on create.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser, seedStakeholderPreferences, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedVenueUser(ctx: SeedCtx, slug: string) {
  const userId = await seedUser(ctx, {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    role: 'Venue',
  })
  await getOrCreateTestOrg(ctx, userId, slug)
  await seedStakeholderPreferences(ctx, slug, { stakeholderType: 'Venue', acceptanceMode: 'Auto' })
  return userId
}

const VALID_DIVE_SITE_ARGS = {
  name: 'Shark Bay Reef',
  email: 'reef@test.com',
  phone: '+66100000010',
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  kind: 'dive_site' as const,
  features: ['reef' as const],
  confinedCapable: false,
  maxCapacity: 20,
}

const VALID_POOL_ARGS = {
  name: 'Sairee Training Pool',
  email: 'pool@test.com',
  phone: '+66100000011',
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  kind: 'pool' as const,
  features: [],
  maxCapacity: 15,
  maxDepth: 5,
}

const VALID_SHORE_ARGS = {
  name: 'Beach Entry',
  email: 'shore@test.com',
  phone: '+66100000012',
  address: { city: 'Phuket', country: 'TH' },
  lat: 7.88,
  lng: 98.39,
  kind: 'dive_site' as const,
  features: [],
  confinedCapable: true,
  maxCapacity: 10,
}

describe('venues.create — slug minting + inventoryUnit', () => {
  it('mints a unique slug derived from name', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'slug-test') })

    const venueId = await t.withIdentity(orgIdentityFor('slug-test'))
      .mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    const venue = await t.run(async (ctx) => await ctx.db.get(venueId)) as Doc<'venues'>
    expect(venue.slug).toBe('shark-bay-reef')
  })

  it('auto-creates inventoryUnit keyed on venue.slug (not user.slug)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'inv-test') })

    const venueId = await t.withIdentity(orgIdentityFor('inv-test'))
      .mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    const venue = await t.run(async (ctx) => await ctx.db.get(venueId)) as Doc<'venues'>

    const units = await t.run(async (ctx) => {
      return await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
        )
        .collect()
    })
    expect(units).toHaveLength(1)
    expect(units[0].totalUnits).toBe(20)
    expect(units[0].displayName).toBe('Shark Bay Reef')
    expect(units[0].resourceId).toBe('shark-bay-reef')
  })

  it('resolves slug collision with incremental suffix', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'collide-test') })
    const identity = orgIdentityFor('collide-test')

    const firstId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    const secondId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)

    const [first, second] = await t.run(async (ctx) => [
      await ctx.db.get(firstId),
      await ctx.db.get(secondId),
    ]) as [Doc<'venues'>, Doc<'venues'>]

    expect(first.slug).toBe('sairee-training-pool')
    expect(second.slug).toBe('sairee-training-pool-2')
  })
})

describe('venues.create — assertVenueRange enforcement', () => {
  it('rejects pool with maxDepth above 60m cap', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'pool-deep') })
    await expect(
      t.withIdentity(orgIdentityFor('pool-deep')).mutation(api.venues.create, {
        ...VALID_POOL_ARGS,
        maxDepth: 75,
      }),
    ).rejects.toThrow(/max_depth_exceeds_kind_cap/)
  })

  it('rejects pool with maxCapacity above 50 cap', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'pool-big') })
    await expect(
      t.withIdentity(orgIdentityFor('pool-big')).mutation(api.venues.create, {
        ...VALID_POOL_ARGS,
        maxCapacity: 75,
      }),
    ).rejects.toThrow(/max_capacity_exceeds_kind_cap/)
  })

  it('rejects negative maxDepth', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'neg-depth') })
    await expect(
      t.withIdentity(orgIdentityFor('neg-depth')).mutation(api.venues.create, {
        ...VALID_POOL_ARGS,
        maxDepth: -3,
      }),
    ).rejects.toThrow(/invalid_max_depth/)
  })

  it('rejects pool with confinedCapable=false', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'pool-noconfined') })
    await expect(
      t.withIdentity(orgIdentityFor('pool-noconfined')).mutation(api.venues.create, {
        ...VALID_POOL_ARGS,
        confinedCapable: false,
      }),
    ).rejects.toThrow(/pool_must_be_confined_capable/)
  })
})

describe('venues.create — multi-row under one org', () => {
  it('allows an operator to create multiple venues (no .unique() idempotency)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'multi-op') })
    const identity = orgIdentityFor('multi-op')

    const poolId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    const reefId = await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)
    const shoreId = await t.withIdentity(identity).mutation(api.venues.create, VALID_SHORE_ARGS)

    expect(poolId).not.toBe(reefId)
    expect(reefId).not.toBe(shoreId)

    const venues = await t.withIdentity(identity).query(api.venues.mine, {})
    expect(venues).toHaveLength(3)
  })
})

describe('venues.update — by venueId', () => {
  it('patches the correct row among multiple venues', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'patch-target') })
    const identity = orgIdentityFor('patch-target')

    const poolId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    const reefId = await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    await t.withIdentity(identity).mutation(api.venues.update, {
      venueId: poolId,
      maxCapacity: 22,
    })

    const [pool, reef] = await t.run(async (ctx) => [
      await ctx.db.get(poolId),
      await ctx.db.get(reefId),
    ]) as [Doc<'venues'>, Doc<'venues'>]

    expect(pool.maxCapacity).toBe(22)
    expect(reef.maxCapacity).toBe(20)
  })

  it('syncs inventoryUnit.totalUnits to the correct venue row on capacity change', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'cap-sync') })
    const identity = orgIdentityFor('cap-sync')

    const poolId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    await t.withIdentity(identity).mutation(api.venues.update, {
      venueId: poolId,
      maxCapacity: 30,
    })

    const pool = await t.run(async (ctx) => await ctx.db.get(poolId)) as Doc<'venues'>
    const poolUnit = await t.run(async (ctx) =>
      await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', pool.slug).eq('ownerType', 'Venue'),
        )
        .unique(),
    )
    expect(poolUnit?.totalUnits).toBe(30)
  })

  it('rejects update of a venue owned by a different organization', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedVenueUser(ctx, 'venue-owner')
      await seedVenueUser(ctx, 'other-op')
    })

    const venueId = await t.withIdentity(orgIdentityFor('venue-owner'))
      .mutation(api.venues.create, VALID_POOL_ARGS)

    await expect(
      t.withIdentity(orgIdentityFor('other-op')).mutation(api.venues.update, {
        venueId,
        maxCapacity: 99,
      }),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})

describe('venues.remove', () => {
  it('deletes the venue row and its inventoryUnit', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'del-test') })
    const identity = orgIdentityFor('del-test')

    const venueId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    const venue = await t.run(async (ctx) => await ctx.db.get(venueId)) as Doc<'venues'>

    await t.withIdentity(identity).mutation(api.venues.remove, { venueId })

    const [venueAfter, units] = await t.run(async (ctx) => [
      await ctx.db.get(venueId),
      await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
        )
        .collect(),
    ])

    expect(venueAfter).toBeNull()
    expect(units).toHaveLength(0)
  })

  it('throws CONFLICT when an active reservation exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'cflct-owner') })
    const identity = orgIdentityFor('cflct-owner')

    const venueId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    const venue = await t.run(async (ctx) => await ctx.db.get(venueId)) as Doc<'venues'>

    await t.run(async (ctx) => {
      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
        )
        .unique()
      if (!unit) throw new Error('expected unit')
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'cflct-owner',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-05-01',
        endDate: '2026-05-01',
        divers: [],
        operatorName: 'Test Op',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit._id,
        date: '2026-05-01',
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit._id,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
    })

    await expect(
      t.withIdentity(identity).mutation(api.venues.remove, { venueId }),
    ).rejects.toThrow(/CONFLICT/)
  })

  it('cascades unit + snapshots + reservations on successful remove', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'casc-owner') })
    const identity = orgIdentityFor('casc-owner')

    const venueId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    const venue = await t.run(async (ctx) => await ctx.db.get(venueId)) as Doc<'venues'>

    await t.run(async (ctx) => {
      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
        )
        .unique()
      if (!unit) throw new Error('expected unit')
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unit._id,
        date: '2026-05-01',
        windowStart: '09:00',
        windowEnd: '17:00',
        totalUnits: 15,
        reservedUnits: 0,
        availableUnits: 15,
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'casc-owner',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-05-01',
        endDate: '2026-05-01',
        divers: [],
        operatorName: 'Test Op',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit._id,
        date: '2026-05-01',
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })
      // Vacated reservation (not active — won't block)
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit._id,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Vacated',
      })
    })

    await t.withIdentity(identity).mutation(api.venues.remove, { venueId })

    const { units, reservations, snapshots } = await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
        )
        .collect()
      const reservations = await ctx.db.query('reservations').collect()
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      return { units, reservations, snapshots }
    })

    expect(units).toHaveLength(0)
    expect(reservations).toHaveLength(0)
    expect(snapshots).toHaveLength(0)
  })

  it('rejects remove of a venue owned by a different organization', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedVenueUser(ctx, 'del-owner')
      await seedVenueUser(ctx, 'del-intruder')
    })

    const venueId = await t.withIdentity(orgIdentityFor('del-owner'))
      .mutation(api.venues.create, VALID_POOL_ARGS)

    await expect(
      t.withIdentity(orgIdentityFor('del-intruder')).mutation(api.venues.remove, { venueId }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('returns silently when the venue does not exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'del-ghost') })
    const identity = orgIdentityFor('del-ghost')

    const realId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    await t.withIdentity(identity).mutation(api.venues.remove, { venueId: realId })

    await expect(
      t.withIdentity(identity).mutation(api.venues.remove, { venueId: realId }),
    ).resolves.toBeNull()
  })
})

describe('venues.mine — multi-row return', () => {
  it('returns an array of all venues for the active org', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'mine-test') })
    const identity = orgIdentityFor('mine-test')

    const venues = await t.withIdentity(identity).query(api.venues.mine, {})
    expect(venues).toEqual([])

    await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    const venuesAfter = await t.withIdentity(identity).query(api.venues.mine, {})
    expect(venuesAfter).toHaveLength(2)
    expect(venuesAfter.map((v) => v.kind).sort()).toEqual(['dive_site', 'pool'])
  })

  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    const venues = await t.query(api.venues.mine, {})
    expect(venues).toEqual([])
  })
})

describe('venues.visibleToMe — destination-scoped discovery', () => {
  it('returns own-org venues plus destination-org venues for an operator with destinationIds', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const areaOrgId = await ctx.db.insert('organizations', {
        slug: 'south-andaman',
        name: 'South Andaman',
        isAreaOrg: true,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('venues', {
        organizationId: areaOrgId,
        slug: 'racha-yai',
        name: 'Racha Yai',
        kind: 'dive_site',
        features: [],
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.6018,
        lng: 98.3633,
        verified: true,
      })
      const operatorId = await seedVenueUser(ctx, 'rene-vis')
      await ctx.db.patch(operatorId, {})
      const user = await ctx.db.get(operatorId)
      const operatorOrgId = user?.organizationId
      if (!operatorOrgId) throw new Error('operator org missing')
      await ctx.db.patch(operatorOrgId, { destinationIds: [areaOrgId] })
      await ctx.db.insert('venues', {
        organizationId: operatorOrgId,
        slug: 'sea-fun-pool',
        name: 'Sea Fun Pool',
        kind: 'pool',
        features: [],
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8569,
        lng: 98.2859,
        maxDepth: 2.5,
        maxCapacity: 50,
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('rene-vis')).query(api.venues.visibleToMe, {})
    const slugs = results.map((v) => v.slug).sort()
    expect(slugs).toEqual(['racha-yai', 'sea-fun-pool'])
  })

  it('returns own-org venues only when destinationIds is undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const operatorId = await seedVenueUser(ctx, 'solo-vis')
      const user = await ctx.db.get(operatorId)
      const operatorOrgId = user?.organizationId
      if (!operatorOrgId) throw new Error('operator org missing')
      await ctx.db.insert('venues', {
        organizationId: operatorOrgId,
        slug: 'solo-pool',
        name: 'Solo Pool',
        kind: 'pool',
        features: [],
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10,
        lng: 99,
        maxDepth: 2,
        maxCapacity: 10,
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('solo-vis')).query(api.venues.visibleToMe, {})
    expect(results.map((v) => v.slug)).toEqual(['solo-pool'])
  })

  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    const result = await t.query(api.venues.visibleToMe, {})
    expect(result).toEqual([])
  })
})

describe('venues.bySlug — cross-operator resolution', () => {
  it('resolves a venue by slug regardless of calling user', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedVenueUser(ctx, 'slug-owner')
      await seedVenueUser(ctx, 'slug-lookup')
    })

    await t.withIdentity(orgIdentityFor('slug-owner'))
      .mutation(api.venues.create, VALID_POOL_ARGS)

    const venue = await t.withIdentity(orgIdentityFor('slug-lookup'))
      .query(api.venues.bySlug, { slug: 'sairee-training-pool' })

    expect(venue).not.toBeNull()
    expect(venue?.name).toBe('Sairee Training Pool')
  })

  it('returns null for unknown slug', async () => {
    const t = makeT()
    const venue = await t.query(api.venues.bySlug, { slug: 'does-not-exist' })
    expect(venue).toBeNull()
  })
})

describe('venues — access control persistence', () => {
  it('persists isAllowed + notAllowed arrays per venue row', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'acl-test') })
    const identity = orgIdentityFor('acl-test')

    const venueId = await t.withIdentity(identity).mutation(api.venues.create, {
      ...VALID_POOL_ARGS,
      isAllowed: ['dc-a', 'dc-b'],
      notAllowed: ['blocked-dc'],
    })

    const venue = await t.run(async (ctx) => await ctx.db.get(venueId)) as Doc<'venues'>
    expect(venue.isAllowed).toEqual(['dc-a', 'dc-b'])
    expect(venue.notAllowed).toEqual(['blocked-dc'])
  })

  it('allows updating access-control lists independently per venue', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'acl-update') })
    const identity = orgIdentityFor('acl-update')

    const poolId = await t.withIdentity(identity).mutation(api.venues.create, VALID_POOL_ARGS)
    const reefId = await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    await t.withIdentity(identity).mutation(api.venues.update, {
      venueId: poolId,
      isAllowed: ['only-this-dc'],
    })

    const [pool, reef] = await t.run(async (ctx) => [
      await ctx.db.get(poolId),
      await ctx.db.get(reefId),
    ]) as [Doc<'venues'>, Doc<'venues'>]

    expect(pool.isAllowed).toEqual(['only-this-dc'])
    expect(reef.isAllowed ?? []).toEqual([])
  })
})

describe('venues.create — access control', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.venues.create, VALID_DIVE_SITE_ARGS),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects callers without the Venue role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-user',
        slug: 'dc-user',
        email: 'dc@test.com',
        name: 'DC User',
        firstName: 'DC',
        lastName: 'User',
        role: 'DiveCenter',
      })
      await getOrCreateTestOrg(ctx, userId, 'dc-user')
    })

    await expect(
      t.withIdentity(orgIdentityFor('dc-user'))
        .mutation(api.venues.create, VALID_DIVE_SITE_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})

describe('venues.* — Rule 12: profileComplete denorm flips', () => {
  async function readVenueRoleComplete(t: ReturnType<typeof makeT>, slug: string): Promise<boolean | undefined> {
    return await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (!user) return undefined
      const row = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', user._id).eq('role', 'Venue'))
        .unique()
      return row?.profileComplete
    })
  }

  it('flips profileComplete=true on venues.create when completeness reaches 100%', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'venue-complete-create') })

    expect(await readVenueRoleComplete(t, 'venue-complete-create')).not.toBe(true)

    await t.withIdentity(orgIdentityFor('venue-complete-create'))
      .mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    expect(await readVenueRoleComplete(t, 'venue-complete-create')).toBe(true)
  })

  it('re-computes profileComplete on venues.update (denorm stays fresh)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'venue-complete-update') })
    const identity = orgIdentityFor('venue-complete-update')
    const venueId = await t.withIdentity(identity)
      .mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    expect(await readVenueRoleComplete(t, 'venue-complete-update')).toBe(true)

    await t.withIdentity(identity).mutation(api.venues.update, {
      venueId,
      name: 'Renamed Reef',
    })

    expect(await readVenueRoleComplete(t, 'venue-complete-update')).toBe(true)
  })

  it('flips profileComplete=false when the last venue is removed', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'venue-complete-remove') })
    const identity = orgIdentityFor('venue-complete-remove')
    const venueId = await t.withIdentity(identity)
      .mutation(api.venues.create, VALID_DIVE_SITE_ARGS)

    expect(await readVenueRoleComplete(t, 'venue-complete-remove')).toBe(true)

    await t.withIdentity(identity).mutation(api.venues.remove, { venueId })

    expect(await readVenueRoleComplete(t, 'venue-complete-remove')).not.toBe(true)
  })
})

describe('venues.create — i18n validators at boundary', () => {
  it('rejects non-E.164 phone with VALIDATION', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'phone-check') })
    await expect(
      t.withIdentity(orgIdentityFor('phone-check'))
        .mutation(api.venues.create, { ...VALID_DIVE_SITE_ARGS, phone: 'not-e164' }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('rejects invalid ISO-2 country on address with VALIDATION', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'country-check') })
    await expect(
      t.withIdentity(orgIdentityFor('country-check'))
        .mutation(api.venues.create, {
          ...VALID_DIVE_SITE_ARGS,
          address: { city: 'X', country: 'zz' },
        }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('accepts empty-string phone (optional field convention)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'empty-phone') })
    const venueId = await t.withIdentity(orgIdentityFor('empty-phone'))
      .mutation(api.venues.create, { ...VALID_DIVE_SITE_ARGS, phone: '' })
    expect(venueId).toBeTruthy()
  })
})

describe('venues.update — i18n validators at boundary', () => {
  it('rejects non-E.164 phone update with VALIDATION', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedVenueUser(ctx, 'update-phone') })
    const identity = orgIdentityFor('update-phone')
    const venueId = await t.withIdentity(identity).mutation(api.venues.create, VALID_DIVE_SITE_ARGS)
    await expect(
      t.withIdentity(identity).mutation(api.venues.update, {
        venueId,
        phone: '1234',
      }),
    ).rejects.toThrow(/VALIDATION/)
  })
})

// Prevent "unused import" TS on helper types kept for future suite additions
void (null as unknown as Id<'venues'>)
