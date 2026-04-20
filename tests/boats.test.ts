import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, seedBoatProfile, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'Boat' | 'DiveCenter' = 'Boat') {
  const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

const VALID_BOAT_ARGS = {
  name: 'MV Seatran',
  placeName: 'Koh Tao',
  country: 'Thailand',
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
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'boat-owner') })

    const boatId = await t.withIdentity(orgIdentityFor('boat-owner'))
      .mutation(api.boats.create, VALID_BOAT_ARGS)

    expect(typeof boatId).toBe('string')
    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId as Id<'boats'>) as Doc<'boats'> | null
      expect(boat).not.toBeNull()
      expect(boat!.name).toBe('MV Seatran')
      expect(boat!.userId).toEqual(userId)
      expect(boat!.hasCompressor).toBe(true) // day_boat → smart default true
      expect(boat!.verified).toBe(false)
      expect(boat!.fleet).toHaveLength(1)
    })
  })

  it('derives hasCompressor=false for non-day-boat/liveaboard fleet', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'speedboat-owner') })

    const boatId = await t.withIdentity(orgIdentityFor('speedboat-owner'))
      .mutation(api.boats.create, {
        ...VALID_BOAT_ARGS,
        fleet: [{ boatName: 'Speedster', maxPax: 8, boatType: 'speedboat' as const }],
      })

    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId as Id<'boats'>) as Doc<'boats'> | null
      expect(boat!.hasCompressor).toBe(false)
    })
  })

  it('derives hasCompressor=true for liveaboard fleet', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'liveaboard-owner') })

    const boatId = await t.withIdentity(orgIdentityFor('liveaboard-owner'))
      .mutation(api.boats.create, {
        ...VALID_BOAT_ARGS,
        fleet: [{ boatName: 'MV Explorer', maxPax: 30, boatType: 'liveaboard' as const }],
      })

    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId as Id<'boats'>) as Doc<'boats'> | null
      expect(boat!.hasCompressor).toBe(true)
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-boat') })
    const identity = orgIdentityFor('dup-boat')

    const id1 = await t.withIdentity(identity).mutation(api.boats.create, VALID_BOAT_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.boats.create, { ...VALID_BOAT_ARGS, name: 'Different' })
    expect(id1).toBe(id2)
  })
})

describe('boats.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.boats.update, { name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-profile') })
    await expect(
      t.withIdentity(orgIdentityFor('no-profile')).mutation(api.boats.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('re-derives hasCompressor when fleet changes', async () => {
    const t = makeT()
    let boatId: Awaited<ReturnType<typeof seedBoatProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'fleet-change-boat')
      boatId = await seedBoatProfile(ctx, userId)
    })

    // Update fleet to include a day_boat → hasCompressor should become true
    await t.withIdentity(orgIdentityFor('fleet-change-boat'))
      .mutation(api.boats.update, {
        fleet: [{ boatName: 'Day Runner', maxPax: 12, boatType: 'day_boat' as const }],
      })

    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId!) as Doc<'boats'> | null
      expect(boat!.hasCompressor).toBe(true)
    })
  })

  it('allows explicit hasCompressor override on update', async () => {
    const t = makeT()
    let boatId: Awaited<ReturnType<typeof seedBoatProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'explicit-comp-boat')
      // Seed with speedboat fleet (no day_boat/liveaboard) and hasCompressor=false
      boatId = await seedBoatProfile(ctx, userId, {
        fleet: [{ boatName: 'Speedster', maxPax: 8, boatType: 'speedboat' }],
        hasCompressor: false,
      })
    })

    // Explicitly set hasCompressor=true even without day_boat/liveaboard fleet
    await t.withIdentity(orgIdentityFor('explicit-comp-boat'))
      .mutation(api.boats.update, { hasCompressor: true })

    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId!) as Doc<'boats'> | null
      expect(boat!.hasCompressor).toBe(true)
    })
  })

  it('updates boat profile fields', async () => {
    const t = makeT()
    let boatId: Awaited<ReturnType<typeof seedBoatProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-boat')
      boatId = await seedBoatProfile(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('upd-boat'))
      .mutation(api.boats.update, { name: 'Updated Boat' })

    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId!) as Doc<'boats'> | null
      expect(boat!.name).toBe('Updated Boat')
      expect(boat!.email).toBe('boat@test.com') // unchanged
    })
  })
})

describe('boats.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.boats.mine, {})).toBeNull()
  })

  it('returns null when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-boat') })
    expect(
      await t.withIdentity(orgIdentityFor('no-boat')).query(api.boats.mine, {}),
    ).toBeNull()
  })

  it('returns boat profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-boat')
      await seedBoatProfile(ctx, userId)
    })

    const result = await t.withIdentity(orgIdentityFor('my-boat')).query(api.boats.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Boat')
  })
})
