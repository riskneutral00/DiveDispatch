import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, seedDiveCenterProfile, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'DiveCenter' | 'Boat' = 'DiveCenter') {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
}

const VALID_DC_ARGS = {
  name: 'Sairee Dive',
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.09,
  lng: 99.84,
  email: 'dc@test.com',
  phone: '+66123456789',
  associations: [{ agency: 'PADI', number: '12345' }],
}

describe('diveCenters.create', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.diveCenters.create, VALID_DC_ARGS)).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-DiveCenter roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'boat-user', 'Boat') })
    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|boat-user' }).mutation(api.diveCenters.create, VALID_DC_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates dive center profile', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'dc-owner') })

    const dcId = await t.withIdentity({ tokenIdentifier: 'clerk|dc-owner' })
      .mutation(api.diveCenters.create, VALID_DC_ARGS)

    expect(typeof dcId).toBe('string')
    await t.run(async (ctx) => {
      const dc = await ctx.db.get(dcId as Id<'diveCenters'>) as Doc<'diveCenters'> | null
      expect(dc).not.toBeNull()
      expect(dc!.name).toBe('Sairee Dive')
      expect(dc!.userId).toEqual(userId)
      expect(dc!.verified).toBe(false)
      expect(dc!.associations).toHaveLength(1)
      expect(dc!.associations[0].agency).toBe('PADI')
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-dc') })
    const identity = { tokenIdentifier: 'clerk|dup-dc' }

    const id1 = await t.withIdentity(identity).mutation(api.diveCenters.create, VALID_DC_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.diveCenters.create, { ...VALID_DC_ARGS, name: 'Other' })
    expect(id1).toBe(id2)
  })
})

describe('diveCenters.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.diveCenters.update, { name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-dc') })
    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|no-dc' }).mutation(api.diveCenters.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates dive center fields', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-dc')
      dcId = await seedDiveCenterProfile(ctx, userId)
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|upd-dc' })
      .mutation(api.diveCenters.update, { name: 'Updated DC' })

    await t.run(async (ctx) => {
      const dc = await ctx.db.get(dcId!) as Doc<'diveCenters'> | null
      expect(dc!.name).toBe('Updated DC')
      expect(dc!.email).toBe('dc@test.com')
    })
  })
})

describe('diveCenters.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.diveCenters.mine, {})).toBeNull()
  })

  it('returns null when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-dc-profile') })
    expect(
      await t.withIdentity({ tokenIdentifier: 'clerk|no-dc-profile' }).query(api.diveCenters.mine, {}),
    ).toBeNull()
  })

  it('returns dive center profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-dc')
      await seedDiveCenterProfile(ctx, userId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|my-dc' }).query(api.diveCenters.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test DC')
  })
})
