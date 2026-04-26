import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, seedUserWithOrg as seedUser, getOrCreateTestOrg, seedBoatProfile, seedVenue, seedBooking, seedBookingResource, seedSession, seedReservation, seedInventoryUnit, seedSnapshot } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

const VALID_ARGS = {
  name: 'Sairee Compressor',
  location: 'fixed' as const,
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'comp@test.com',
  phone: '+66123456789',
}

describe('compressors.create', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.compressors.create, VALID_ARGS)).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-Compressor roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dc-user', 'DiveCenter') })
    await expect(
      t.withIdentity(orgIdentityFor('dc-user')).mutation(api.compressors.create, VALID_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates compressor with slug and location', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'comp-owner', 'Compressor') })

    const compId = await t.withIdentity(orgIdentityFor('comp-owner'))
      .mutation(api.compressors.create, VALID_ARGS)

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId as Id<'compressors'>) as Doc<'compressors'> | null
      expect(comp).not.toBeNull()
      expect(comp!.name).toBe('Sairee Compressor')
      expect(comp!.location).toBe('fixed')
      expect(comp!.slug).toBe('sairee-compressor')
      expect(comp!.verified).toBe(false)
    })
  })

  it('allows multiple compressors per org with distinct slugs', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'multi-comp', 'Compressor') })
    const identity = orgIdentityFor('multi-comp')

    const id1 = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.compressors.create, { ...VALID_ARGS, name: 'Other' })
    expect(id1).not.toBe(id2)
  })
})

describe('compressors nitrox range validation', () => {
  it('accepts valid nitrox range on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-ok', 'Compressor') })

    const compId = await t.withIdentity(orgIdentityFor('nitrox-ok'))
      .mutation(api.compressors.create, {
        ...VALID_ARGS,
        gasMixes: ['air', 'nitrox'],
        nitroxMin: 28,
        nitroxMax: 36,
      })

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId as Id<'compressors'>) as Doc<'compressors'> | null
      expect(comp!.nitroxMin).toBe(28)
      expect(comp!.nitroxMax).toBe(36)
    })
  })

  it('rejects nitroxMin below 21 on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-low', 'Compressor') })

    await expect(
      t.withIdentity(orgIdentityFor('nitrox-low'))
        .mutation(api.compressors.create, { ...VALID_ARGS, nitroxMin: 15 }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('rejects nitroxMax above 40 on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-high', 'Compressor') })

    await expect(
      t.withIdentity(orgIdentityFor('nitrox-high'))
        .mutation(api.compressors.create, { ...VALID_ARGS, nitroxMax: 50 }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('rejects nitroxMin > nitroxMax on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-inv', 'Compressor') })

    await expect(
      t.withIdentity(orgIdentityFor('nitrox-inv'))
        .mutation(api.compressors.create, { ...VALID_ARGS, nitroxMin: 36, nitroxMax: 28 }),
    ).rejects.toThrow(/VALIDATION/)
  })
})

describe('compressors.update nitrox range validation', () => {
  it('rejects nitroxMin > nitroxMax on update', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-update-inv', 'Compressor') })
    const identity = orgIdentityFor('nitrox-update-inv')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, {
      ...VALID_ARGS,
      gasMixes: ['air', 'nitrox'],
      nitroxMin: 28,
      nitroxMax: 36,
    })
    await expect(
      t.withIdentity(identity).mutation(api.compressors.update, {
        compressorId: compId as Id<'compressors'>,
        nitroxMin: 36,
        nitroxMax: 28,
      }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('rejects nitroxMax above 40 on update', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-update-high', 'Compressor') })
    const identity = orgIdentityFor('nitrox-update-high')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS)
    await expect(
      t.withIdentity(identity).mutation(api.compressors.update, {
        compressorId: compId as Id<'compressors'>,
        nitroxMax: 50,
      }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('accepts a valid update', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-update-ok', 'Compressor') })
    const identity = orgIdentityFor('nitrox-update-ok')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS)
    await t.withIdentity(identity).mutation(api.compressors.update, {
      compressorId: compId as Id<'compressors'>,
      gasMixes: ['air', 'nitrox'],
      nitroxMin: 24,
      nitroxMax: 32,
    })
    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId as Id<'compressors'>) as Doc<'compressors'> | null
      expect(comp!.nitroxMin).toBe(24)
      expect(comp!.nitroxMax).toBe(32)
    })
  })
})

describe('compressors.visibleToMe — destination-scoped discovery', () => {
  it('returns own-org + destination-org compressors for an operator with destinationIds', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const areaId = await ctx.db.insert('organizations', {
        slug: 'south-andaman',
        name: 'South Andaman',
        isAreaOrg: true,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('compressors', {
        organizationId: areaId,
        slug: 'area-comp',
        name: 'Area Compressor',
        location: 'fixed',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'area@test.com',
        phone: '+66110000000',
        verified: true,
      })
      const operatorId = await seedUser(ctx, 'rene-comp-vis', 'Compressor')
      const user = await ctx.db.get(operatorId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.patch(user.organizationId, { destinationIds: [areaId] })
      await ctx.db.insert('compressors', {
        organizationId: user.organizationId,
        slug: 'rene-comp',
        name: 'Rene Compressor',
        location: 'fixed',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'rene@test.com',
        phone: '+66120000000',
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('rene-comp-vis')).query(api.compressors.visibleToMe, {})
    expect(results.map((c) => c.slug).sort()).toEqual(['area-comp', 'rene-comp'])
  })

  it('returns own-org compressors only when destinationIds is undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'solo-comp-vis', 'Compressor')
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.insert('compressors', {
        organizationId: user.organizationId,
        slug: 'solo-comp',
        name: 'Solo Compressor',
        location: 'fixed',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10,
        lng: 99,
        email: 'solo@test.com',
        phone: '+66130000000',
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('solo-comp-vis')).query(api.compressors.visibleToMe, {})
    expect(results.map((c) => c.slug)).toEqual(['solo-comp'])
  })

  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    expect(await t.query(api.compressors.visibleToMe, {})).toEqual([])
  })
})

describe('compressors.update — location transition clears stale FKs', () => {
  it('clears boatId when transitioning boat → fixed even if caller omits boatId arg', async () => {
    const t = makeT()
    const seed = await t.run(async (ctx) => {
      const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|loc-b2f`, slug: 'loc-b2f', email: 'loc-b2f@test.com', name: 'loc-b2f', firstName: 'Loc', lastName: 'B2F', role: 'Compressor' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'loc-b2f')
      const boatId = await seedBoatProfile(ctx, userId, { organizationId: orgId })
      await seedVenue(ctx, { userId, organizationId: orgId, name: 'Loc Venue' })
      return { boatId }
    })
    const identity = orgIdentityFor('loc-b2f')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, {
      ...VALID_ARGS,
      name: 'B2F Compressor',
      location: 'boat',
      boatId: seed.boatId,
    }) as Id<'compressors'>

    await t.withIdentity(identity).mutation(api.compressors.update, {
      compressorId: compId,
      location: 'fixed',
    })

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId) as Doc<'compressors'> | null
      expect(comp).not.toBeNull()
      expect(comp!.location).toBe('fixed')
      expect(comp!.boatId).toBeUndefined()
      expect(comp!.venueId).toBeUndefined()
    })
  })

  it('clears venueId when transitioning venue → boat even if caller omits venueId arg', async () => {
    const t = makeT()
    const seed = await t.run(async (ctx) => {
      const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|loc-v2b`, slug: 'loc-v2b', email: 'loc-v2b@test.com', name: 'loc-v2b', firstName: 'Loc', lastName: 'V2B', role: 'Compressor' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'loc-v2b')
      const boatId = await seedBoatProfile(ctx, userId, { organizationId: orgId })
      const venueId = await seedVenue(ctx, { userId, organizationId: orgId, name: 'Loc Venue' })
      return { boatId, venueId }
    })
    const identity = orgIdentityFor('loc-v2b')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, {
      ...VALID_ARGS,
      name: 'V2B Compressor',
      location: 'venue',
      venueId: seed.venueId,
    }) as Id<'compressors'>

    await t.withIdentity(identity).mutation(api.compressors.update, {
      compressorId: compId,
      location: 'boat',
      boatId: seed.boatId,
    })

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId) as Doc<'compressors'> | null
      expect(comp!.location).toBe('boat')
      expect(comp!.boatId).toBe(seed.boatId)
      expect(comp!.venueId).toBeUndefined()
    })
  })

  it('clears boatId when transitioning boat → venue even if caller omits boatId arg', async () => {
    const t = makeT()
    const seed = await t.run(async (ctx) => {
      const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|loc-b2v`, slug: 'loc-b2v', email: 'loc-b2v@test.com', name: 'loc-b2v', firstName: 'Loc', lastName: 'B2V', role: 'Compressor' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'loc-b2v')
      const boatId = await seedBoatProfile(ctx, userId, { organizationId: orgId })
      const venueId = await seedVenue(ctx, { userId, organizationId: orgId, name: 'Loc Venue' })
      return { boatId, venueId }
    })
    const identity = orgIdentityFor('loc-b2v')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, {
      ...VALID_ARGS,
      name: 'B2V Compressor',
      location: 'boat',
      boatId: seed.boatId,
    }) as Id<'compressors'>

    await t.withIdentity(identity).mutation(api.compressors.update, {
      compressorId: compId,
      location: 'venue',
      venueId: seed.venueId,
    })

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId) as Doc<'compressors'> | null
      expect(comp!.location).toBe('venue')
      expect(comp!.venueId).toBe(seed.venueId)
      expect(comp!.boatId).toBeUndefined()
    })
  })
})

describe('compressors.remove — cascade + active-reservation guard', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'rm-anon', 'Compressor') })
    const compId = await t.withIdentity(orgIdentityFor('rm-anon'))
      .mutation(api.compressors.create, VALID_ARGS)
    await expect(
      t.mutation(api.compressors.remove, { compressorId: compId as Id<'compressors'> }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects remove of a compressor owned by a different organization', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'rm-owner', 'Compressor')
      await seedUser(ctx, 'rm-intruder', 'Compressor')
    })
    const compId = await t.withIdentity(orgIdentityFor('rm-owner'))
      .mutation(api.compressors.create, VALID_ARGS)
    await expect(
      t.withIdentity(orgIdentityFor('rm-intruder'))
        .mutation(api.compressors.remove, { compressorId: compId as Id<'compressors'> }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('returns silently when the compressor does not exist (idempotent)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'rm-ghost', 'Compressor') })
    const identity = orgIdentityFor('rm-ghost')

    const compId = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS) as Id<'compressors'>
    await t.withIdentity(identity).mutation(api.compressors.remove, { compressorId: compId })

    await expect(
      t.withIdentity(identity).mutation(api.compressors.remove, { compressorId: compId }),
    ).resolves.toBeNull()
  })

  it('deletes compressor when no bookingResources reference it; profileComplete denorm re-computed to false after removal', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'rm-solo', 'Compressor') })
    const identity = orgIdentityFor('rm-solo')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS) as Id<'compressors'>

    await t.withIdentity(identity).mutation(api.compressors.remove, { compressorId: compId })

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId)
      expect(comp).toBeNull()
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', 'rm-solo'))
        .unique()
      if (!user) throw new Error('user not found')
      const role = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', user._id).eq('role', 'Compressor'))
        .unique()
      expect(role?.profileComplete).toBe(false)
    })
  })

  it('throws CONFLICT when a bookingResource references the compressor and its booking has an active reservation', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'rm-conflict', 'Compressor') })
    const identity = orgIdentityFor('rm-conflict')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS) as Id<'compressors'>

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId) as Doc<'compressors'>
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Compressor',
        ownerType: 'Compressor',
        ownerId: comp.slug,
        displayName: comp.name,
        capacityModel: 'Pooled',
        totalUnits: 1,
      })
      const bookingId = await seedBooking(ctx, { ownerId: 'rm-conflict', ownerType: 'DiveCenter' })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Compressor',
        resourceId: comp.slug,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
    })

    await expect(
      t.withIdentity(identity).mutation(api.compressors.remove, { compressorId: compId }),
    ).rejects.toThrow(/CONFLICT/)

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId)
      expect(comp).not.toBeNull()
    })
  })

  it('deletes orphan bookingResources when no active reservations exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'rm-orphan', 'Compressor') })
    const identity = orgIdentityFor('rm-orphan')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS) as Id<'compressors'>

    let orphanResourceId: Id<'bookingResources'> | undefined
    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId) as Doc<'compressors'>
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Compressor',
        ownerType: 'Compressor',
        ownerId: comp.slug,
        displayName: comp.name,
        capacityModel: 'Pooled',
        totalUnits: 1,
      })
      const bookingId = await seedBooking(ctx, { ownerId: 'rm-orphan', ownerType: 'DiveCenter' })
      orphanResourceId = await seedBookingResource(ctx, bookingId, {
        resourceType: 'Compressor',
        resourceId: comp.slug,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Vacated' })
    })

    await t.withIdentity(identity).mutation(api.compressors.remove, { compressorId: compId })

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId)
      expect(comp).toBeNull()
      if (orphanResourceId) {
        const stillThere = await ctx.db.get(orphanResourceId)
        expect(stillThere).toBeNull()
      }
    })
  })

  it('cascades inventoryUnits + snapshots + reservations on successful remove', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'rm-casc', 'Compressor') })
    const identity = orgIdentityFor('rm-casc')
    const compId = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS) as Id<'compressors'>

    const compSlug = await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId) as Doc<'compressors'>
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Compressor',
        ownerType: 'Compressor',
        ownerId: comp.slug,
        displayName: comp.name,
        capacityModel: 'Pooled',
        totalUnits: 1,
      })
      await seedSnapshot(ctx, unitId, {})
      const bookingId = await seedBooking(ctx, { ownerId: 'rm-casc', ownerType: 'DiveCenter' })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Vacated' })
      return comp.slug
    })

    await t.withIdentity(identity).mutation(api.compressors.remove, { compressorId: compId })

    const { units, reservations, snapshots } = await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', compSlug).eq('ownerType', 'Compressor'),
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
})
