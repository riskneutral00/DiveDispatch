import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, seedBoatProfile, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'Boat' | 'DiveCenter' = 'Boat') {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
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
      t.withIdentity({ tokenIdentifier: 'clerk|dc-user' }).mutation(api.boats.create, VALID_BOAT_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates boat profile for Boat user', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'boat-owner') })

    const boatId = await t.withIdentity({ tokenIdentifier: 'clerk|boat-owner' })
      .mutation(api.boats.create, VALID_BOAT_ARGS)

    expect(typeof boatId).toBe('string')
    await t.run(async (ctx) => {
      const boat = await ctx.db.get(boatId as Id<'boats'>) as Doc<'boats'> | null
      expect(boat).not.toBeNull()
      expect(boat!.name).toBe('MV Seatran')
      expect(boat!.userId).toEqual(userId)
      expect(boat!.hasCompressor).toBe(false)
      expect(boat!.verified).toBe(false)
      expect(boat!.fleet).toHaveLength(1)
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-boat') })
    const identity = { tokenIdentifier: 'clerk|dup-boat' }

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
      t.withIdentity({ tokenIdentifier: 'clerk|no-profile' }).mutation(api.boats.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates boat profile fields', async () => {
    const t = makeT()
    let boatId: Awaited<ReturnType<typeof seedBoatProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-boat')
      boatId = await seedBoatProfile(ctx, userId)
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|upd-boat' })
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
      await t.withIdentity({ tokenIdentifier: 'clerk|no-boat' }).query(api.boats.mine, {}),
    ).toBeNull()
  })

  it('returns boat profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-boat')
      await seedBoatProfile(ctx, userId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|my-boat' }).query(api.boats.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Boat')
  })
})
