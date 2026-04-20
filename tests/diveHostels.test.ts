import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'DiveHostel' | 'Boat' = 'DiveHostel') {
  const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

const VALID_DH_ARGS = {
  name: 'Backpacker Bunks',
  address: { city: 'Koh Lanta', country: 'TH' },
  lat: 7.62,
  lng: 99.04,
  email: 'dh@test.com',
  phone: '+66123456789',
  bedCount: 24,
  dormCount: 4,
}

describe('diveHostels.create', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.diveHostels.create, VALID_DH_ARGS)).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-DiveHostel roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'boat-user', 'Boat') })
    await expect(
      t.withIdentity(orgIdentityFor('boat-user')).mutation(api.diveHostels.create, VALID_DH_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates dive hostel profile with bed and dorm counts', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dh-owner') })

    const dhId = await t.withIdentity(orgIdentityFor('dh-owner'))
      .mutation(api.diveHostels.create, VALID_DH_ARGS)

    expect(typeof dhId).toBe('string')
    await t.run(async (ctx) => {
      const dh = await ctx.db.get(dhId as Id<'diveHostels'>) as Doc<'diveHostels'> | null
      expect(dh).not.toBeNull()
      expect(dh!.name).toBe('Backpacker Bunks')
      expect(dh!.bedCount).toBe(24)
      expect(dh!.dormCount).toBe(4)
      expect(dh!.organizationId).toBeDefined()
      expect(dh!.verified).toBe(false)
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-dh') })
    const identity = orgIdentityFor('dup-dh')

    const id1 = await t.withIdentity(identity).mutation(api.diveHostels.create, VALID_DH_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.diveHostels.create, { ...VALID_DH_ARGS, name: 'Other' })
    expect(id1).toBe(id2)
  })
})

describe('diveHostels.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.diveHostels.update, { name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-dh') })
    await expect(
      t.withIdentity(orgIdentityFor('no-dh')).mutation(api.diveHostels.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates bedCount and dormCount', async () => {
    const t = makeT()
    const identity = orgIdentityFor('upd-dh')
    await t.run(async (ctx) => { await seedUser(ctx, 'upd-dh') })
    const dhId = await t.withIdentity(identity).mutation(api.diveHostels.create, VALID_DH_ARGS)

    await t.withIdentity(identity)
      .mutation(api.diveHostels.update, { bedCount: 30, dormCount: 5 })

    await t.run(async (ctx) => {
      const dh = await ctx.db.get(dhId as Id<'diveHostels'>) as Doc<'diveHostels'> | null
      expect(dh!.bedCount).toBe(30)
      expect(dh!.dormCount).toBe(5)
      expect(dh!.name).toBe('Backpacker Bunks')
    })
  })
})

describe('diveHostels.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.diveHostels.mine, {})).toBeNull()
  })

  it('returns null when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-dh-profile') })
    expect(
      await t.withIdentity(orgIdentityFor('no-dh-profile')).query(api.diveHostels.mine, {}),
    ).toBeNull()
  })

  it('returns dive hostel profile for owner', async () => {
    const t = makeT()
    const identity = orgIdentityFor('my-dh')
    await t.run(async (ctx) => { await seedUser(ctx, 'my-dh') })
    await t.withIdentity(identity).mutation(api.diveHostels.create, VALID_DH_ARGS)

    const result = await t.withIdentity(identity).query(api.diveHostels.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Backpacker Bunks')
  })
})
