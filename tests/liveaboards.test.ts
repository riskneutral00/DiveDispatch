import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'Liveaboard' | 'Boat' = 'Liveaboard') {
  const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

const VALID_LA_ARGS = {
  name: 'Pacific Spirit',
  address: { city: 'Phuket', country: 'TH' },
  lat: 7.88,
  lng: 98.39,
  email: 'la@test.com',
  phone: '+66123456789',
}

describe('liveaboards.create', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.liveaboards.create, VALID_LA_ARGS)).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-Liveaboard roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'boat-user', 'Boat') })
    await expect(
      t.withIdentity(orgIdentityFor('boat-user')).mutation(api.liveaboards.create, VALID_LA_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates liveaboard profile', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'la-owner') })

    const laId = await t.withIdentity(orgIdentityFor('la-owner'))
      .mutation(api.liveaboards.create, VALID_LA_ARGS)

    expect(typeof laId).toBe('string')
    await t.run(async (ctx) => {
      const la = await ctx.db.get(laId as Id<'liveaboards'>) as Doc<'liveaboards'> | null
      expect(la).not.toBeNull()
      expect(la!.name).toBe('Pacific Spirit')
      expect(la!.organizationId).toBeDefined()
      expect(la!.verified).toBe(false)
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-la') })
    const identity = orgIdentityFor('dup-la')

    const id1 = await t.withIdentity(identity).mutation(api.liveaboards.create, VALID_LA_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.liveaboards.create, { ...VALID_LA_ARGS, name: 'Other' })
    expect(id1).toBe(id2)
  })
})

describe('liveaboards.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.liveaboards.update, { name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-la') })
    await expect(
      t.withIdentity(orgIdentityFor('no-la')).mutation(api.liveaboards.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates liveaboard fields', async () => {
    const t = makeT()
    const identity = orgIdentityFor('upd-la')
    await t.run(async (ctx) => { await seedUser(ctx, 'upd-la') })
    const laId = await t.withIdentity(identity).mutation(api.liveaboards.create, VALID_LA_ARGS)

    await t.withIdentity(identity)
      .mutation(api.liveaboards.update, { name: 'Updated LA' })

    await t.run(async (ctx) => {
      const la = await ctx.db.get(laId as Id<'liveaboards'>) as Doc<'liveaboards'> | null
      expect(la!.name).toBe('Updated LA')
      expect(la!.email).toBe('la@test.com')
    })
  })
})

describe('liveaboards.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.liveaboards.mine, {})).toBeNull()
  })

  it('returns null when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-la-profile') })
    expect(
      await t.withIdentity(orgIdentityFor('no-la-profile')).query(api.liveaboards.mine, {}),
    ).toBeNull()
  })

  it('returns liveaboard profile for owner', async () => {
    const t = makeT()
    const identity = orgIdentityFor('my-la')
    await t.run(async (ctx) => { await seedUser(ctx, 'my-la') })
    await t.withIdentity(identity).mutation(api.liveaboards.create, VALID_LA_ARGS)

    const result = await t.withIdentity(identity).query(api.liveaboards.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Pacific Spirit')
  })
})
