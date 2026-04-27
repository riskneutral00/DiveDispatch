import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUserWithOrg as seedUser, seedBoatProfile } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

const VALID_BOAT_ARGS = {
  name: 'MV Seatran',
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'boat@test.com',
  phone: '+66123456789',
  fleet: [{ boatName: 'MV Seatran', maxPax: 20, boatType: 'day_boat' as const }],
}

describe('boats.create', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.boats.create, VALID_BOAT_ARGS)).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-Boat roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dc-user', 'DiveCenter') })
    await expect(
      t.withIdentity(orgIdentityFor('dc-user')).mutation(api.boats.create, VALID_BOAT_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates boat profile for Boat user', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'boat-owner', 'Boat') })

    const boatId = await t.withIdentity(orgIdentityFor('boat-owner'))
      .mutation(api.boats.create, VALID_BOAT_ARGS)

    expect(typeof boatId).toBe('string')
    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId as Id<'boats'>) as Doc<'boats'> | null
      expect(boat).not.toBeNull()
      expect(boat!.name).toBe('MV Seatran')
      expect(boat!.organizationId).toBeDefined()
      expect(boat!.verified).toBe(false)
      expect(boat!.fleet).toHaveLength(1)
    })
  })

  it('second create with distinct name mints distinct row (multi-row)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-boat', 'Boat') })
    const identity = orgIdentityFor('dup-boat')

    const id1 = await t.withIdentity(identity).mutation(api.boats.create, VALID_BOAT_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.boats.create, { ...VALID_BOAT_ARGS, name: 'Different' })
    expect(id1).not.toBe(id2)
  })
})

describe('boats.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    let boatId: Awaited<ReturnType<typeof seedBoatProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'unauth-boat', 'Boat')
      boatId = await seedBoatProfile(ctx, userId)
    })
    await expect(t.mutation(api.boats.update, { entityId: boatId!, name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when entity does not exist', async () => {
    const t = makeT()
    let stranger: Awaited<ReturnType<typeof seedBoatProfile>> | undefined
    await t.run(async (ctx) => {
      const ownerId = await seedUser(ctx, 'stranger-boat-owner', 'Boat')
      stranger = await seedBoatProfile(ctx, ownerId)
      await ctx.db.delete(stranger)
      await seedUser(ctx, 'no-profile', 'Boat')
    })
    await expect(
      t.withIdentity(orgIdentityFor('no-profile')).mutation(api.boats.update, { entityId: stranger!, name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates boat profile fields', async () => {
    const t = makeT()
    let boatId: Awaited<ReturnType<typeof seedBoatProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-boat', 'Boat')
      boatId = await seedBoatProfile(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('upd-boat'))
      .mutation(api.boats.update, { entityId: boatId!, name: 'Updated Boat' })

    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId!) as Doc<'boats'> | null
      expect(boat!.name).toBe('Updated Boat')
      expect(boat!.email).toBe('boat@test.com') // unchanged
    })
  })
})

describe('boats.mine', () => {
  it('returns empty array for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.boats.mine, {})).toEqual([])
  })

  it('returns empty array when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-boat', 'Boat') })
    expect(
      await t.withIdentity(orgIdentityFor('no-boat')).query(api.boats.mine, {}),
    ).toEqual([])
  })

  it('returns boat profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-boat', 'Boat')
      await seedBoatProfile(ctx, userId)
    })

    const result = await t.withIdentity(orgIdentityFor('my-boat')).query(api.boats.mine, {})
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Boat')
  })
})

describe('boats.visibleToMe — destination-scoped discovery', () => {
  it('returns own-org + destination-org boats for an operator with destinationIds', async () => {
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
      await ctx.db.insert('boats', {
        organizationId: areaId,
        slug: 'boat-area',
        name: 'Area Boat',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'area@test.com',
        phone: '+66110000000',
        fleet: [],
        verified: true,
      })
      const operatorId = await seedUser(ctx, 'rene-boat-vis', 'Boat')
      const user = await ctx.db.get(operatorId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.patch(user.organizationId, { destinationIds: [areaId] })
      await ctx.db.insert('boats', {
        organizationId: user.organizationId,
        slug: 'boat-rene',
        name: 'Rene Boat',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'rene@test.com',
        phone: '+66120000000',
        fleet: [],
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('rene-boat-vis')).query(api.boats.visibleToMe, {})
    expect(results.map((b) => b.name).sort()).toEqual(['Area Boat', 'Rene Boat'])
  })

  it('returns own-org boats only when destinationIds is undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'solo-boat-vis', 'Boat')
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.insert('boats', {
        organizationId: user.organizationId,
        slug: 'boat-solo',
        name: 'Solo Boat',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10,
        lng: 99,
        email: 'solo@test.com',
        phone: '+66130000000',
        fleet: [],
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('solo-boat-vis')).query(api.boats.visibleToMe, {})
    expect(results.map((b) => b.name)).toEqual(['Solo Boat'])
  })

  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    expect(await t.query(api.boats.visibleToMe, {})).toEqual([])
  })
})

describe('boats.archive', () => {
  async function readBoatRoleComplete(t: ReturnType<typeof makeT>, slug: string): Promise<boolean | undefined> {
    return await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (!user) return undefined
      const row = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', user._id).eq('role', 'Boat'))
        .unique()
      return row?.profileComplete
    })
  }

  it('sets archivedAt on the row', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'archive-boat-owner', 'Boat') })
    const identity = orgIdentityFor('archive-boat-owner')

    const boatId = await t.withIdentity(identity).mutation(api.boats.create, VALID_BOAT_ARGS)
    await t.withIdentity(identity).mutation(api.boats.archive, { entityId: boatId })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(boatId as Id<'boats'>) as Doc<'boats'> | null
      expect(row?.archivedAt).toBeTypeOf('number')
    })
  })

  it('archiving the last active boat re-evaluates userRoles.profileComplete', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'archive-last-boat', 'Boat') })
    const identity = orgIdentityFor('archive-last-boat')

    const boatId = await t.withIdentity(identity).mutation(api.boats.create, VALID_BOAT_ARGS)

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', 'archive-last-boat'))
        .unique()
      const role = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', user!._id).eq('role', 'Boat'))
        .unique()
      await ctx.db.patch(role!._id, { profileComplete: true })
      await ctx.db.patch(boatId as Id<'boats'>, { profileComplete: true })
    })

    expect(await readBoatRoleComplete(t, 'archive-last-boat')).toBe(true)

    await t.withIdentity(identity).mutation(api.boats.archive, { entityId: boatId })
    expect(await readBoatRoleComplete(t, 'archive-last-boat')).not.toBe(true)
  })

  it('throws NOT_FOUND for unknown entityId', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'archive-not-found', 'Boat') })
    const identity = orgIdentityFor('archive-not-found')

    const realId = await t.withIdentity(identity).mutation(api.boats.create, VALID_BOAT_ARGS)
    await t.run(async (ctx) => { await ctx.db.delete(realId as Id<'boats'>) })

    await expect(
      t.withIdentity(identity).mutation(api.boats.archive, { entityId: realId }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('throws FORBIDDEN when archiving a boat owned by a different org', async () => {
    const t = makeT()
    let strangerBoatId: Id<'boats'> | null = null
    await t.run(async (ctx) => {
      const ownerId = await seedUser(ctx, 'cross-org-boat-owner', 'Boat')
      const ownerUser = await ctx.db.get(ownerId)
      strangerBoatId = await ctx.db.insert('boats', {
        organizationId: ownerUser!.organizationId!,
        slug: 'foreign-boat',
        name: 'Foreign Boat',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.9,
        lng: 98.4,
        email: 'foreign@test.com',
        phone: '+66999999999',
        fleet: [],
        verified: true,
      })
      await seedUser(ctx, 'archive-cross-org', 'Boat')
    })

    await expect(
      t.withIdentity(orgIdentityFor('archive-cross-org'))
        .mutation(api.boats.archive, { entityId: strangerBoatId! }),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})
