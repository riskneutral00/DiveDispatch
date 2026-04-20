import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'DiveResort' | 'Boat' = 'DiveResort') {
  const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

const VALID_DR_ARGS = {
  name: 'Coral Bay Resort',
  address: { city: 'Krabi', country: 'TH' },
  lat: 8.06,
  lng: 98.91,
  email: 'dr@test.com',
  phone: '+66123456789',
}

describe('diveResorts.create', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.diveResorts.create, VALID_DR_ARGS)).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-DiveResort roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'boat-user', 'Boat') })
    await expect(
      t.withIdentity(orgIdentityFor('boat-user')).mutation(api.diveResorts.create, VALID_DR_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates dive resort profile', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dr-owner') })

    const drId = await t.withIdentity(orgIdentityFor('dr-owner'))
      .mutation(api.diveResorts.create, VALID_DR_ARGS)

    expect(typeof drId).toBe('string')
    await t.run(async (ctx) => {
      const dr = await ctx.db.get(drId as Id<'diveResorts'>) as Doc<'diveResorts'> | null
      expect(dr).not.toBeNull()
      expect(dr!.name).toBe('Coral Bay Resort')
      expect(dr!.organizationId).toBeDefined()
      expect(dr!.verified).toBe(false)
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-dr') })
    const identity = orgIdentityFor('dup-dr')

    const id1 = await t.withIdentity(identity).mutation(api.diveResorts.create, VALID_DR_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.diveResorts.create, { ...VALID_DR_ARGS, name: 'Other' })
    expect(id1).toBe(id2)
  })
})

describe('diveResorts.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.diveResorts.update, { name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-dr') })
    await expect(
      t.withIdentity(orgIdentityFor('no-dr')).mutation(api.diveResorts.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates dive resort fields', async () => {
    const t = makeT()
    const identity = orgIdentityFor('upd-dr')
    await t.run(async (ctx) => { await seedUser(ctx, 'upd-dr') })
    const drId = await t.withIdentity(identity).mutation(api.diveResorts.create, VALID_DR_ARGS)

    await t.withIdentity(identity)
      .mutation(api.diveResorts.update, { name: 'Updated DR' })

    await t.run(async (ctx) => {
      const dr = await ctx.db.get(drId as Id<'diveResorts'>) as Doc<'diveResorts'> | null
      expect(dr!.name).toBe('Updated DR')
      expect(dr!.email).toBe('dr@test.com')
    })
  })
})

describe('diveResorts.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.diveResorts.mine, {})).toBeNull()
  })

  it('returns null when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-dr-profile') })
    expect(
      await t.withIdentity(orgIdentityFor('no-dr-profile')).query(api.diveResorts.mine, {}),
    ).toBeNull()
  })

  it('returns dive resort profile for owner', async () => {
    const t = makeT()
    const identity = orgIdentityFor('my-dr')
    await t.run(async (ctx) => { await seedUser(ctx, 'my-dr') })
    await t.withIdentity(identity).mutation(api.diveResorts.create, VALID_DR_ARGS)

    const result = await t.withIdentity(identity).query(api.diveResorts.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Coral Bay Resort')
  })
})
