import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUserWithOrg as seedUser, seedDiveCenterProfile } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

const VALID_DC_ARGS = {
  name: 'Sairee Dive',
  address: { city: 'Koh Tao', country: 'TH' },
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
      t.withIdentity(orgIdentityFor('boat-user')).mutation(api.diveCenters.create, VALID_DC_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates dive center profile', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'dc-owner', 'DiveCenter') })

    const dcId = await t.withIdentity(orgIdentityFor('dc-owner'))
      .mutation(api.diveCenters.create, VALID_DC_ARGS)

    expect(typeof dcId).toBe('string')
    await t.run(async (ctx) => {
      const dc = await ctx.db.get(dcId as Id<'diveCenters'>) as Doc<'diveCenters'> | null
      expect(dc).not.toBeNull()
      expect(dc!.name).toBe('Sairee Dive')
      expect(dc!.organizationId).toBeDefined()
      expect(dc!.verified).toBe(false)
      expect(dc!.associations).toHaveLength(1)
      expect(dc!.associations[0].agency).toBe('PADI')
    })
  })

  it('second create with distinct name mints distinct row (multi-row)', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-dc', 'DiveCenter') })
    const identity = orgIdentityFor('dup-dc')

    const id1 = await t.withIdentity(identity).mutation(api.diveCenters.create, VALID_DC_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.diveCenters.create, { ...VALID_DC_ARGS, name: 'Other' })
    expect(id1).not.toBe(id2)
  })
})

describe('diveCenters.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'unauth-dc', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, userId)
    })
    await expect(t.mutation(api.diveCenters.update, { entityId: dcId!, name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when entity does not exist', async () => {
    const t = makeT()
    let stranger: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const ownerId = await seedUser(ctx, 'stranger-dc-owner', 'DiveCenter')
      stranger = await seedDiveCenterProfile(ctx, ownerId)
      await ctx.db.delete(stranger)
      await seedUser(ctx, 'no-dc', 'DiveCenter')
    })
    await expect(
      t.withIdentity(orgIdentityFor('no-dc')).mutation(api.diveCenters.update, { entityId: stranger!, name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates dive center fields', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-dc', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('upd-dc'))
      .mutation(api.diveCenters.update, { entityId: dcId!, name: 'Updated DC' })

    await t.run(async (ctx) => {
      const dc = await ctx.db.get(dcId!) as Doc<'diveCenters'> | null
      expect(dc!.name).toBe('Updated DC')
      expect(dc!.email).toBe('dc@test.com')
    })
  })
})

describe('diveCenters.mine', () => {
  it('returns empty array for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.diveCenters.mine, {})).toEqual([])
  })

  it('returns empty array when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-dc-profile', 'DiveCenter') })
    expect(
      await t.withIdentity(orgIdentityFor('no-dc-profile')).query(api.diveCenters.mine, {}),
    ).toEqual([])
  })

  it('returns dive center profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-dc', 'DiveCenter')
      await seedDiveCenterProfile(ctx, userId)
    })

    const result = await t.withIdentity(orgIdentityFor('my-dc')).query(api.diveCenters.mine, {})
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test DC')
  })

  it('returns multiple rows for users who own multiple dive centers', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => {
      userId = await seedUser(ctx, 'multi-dc', 'DiveCenter')
    })

    const identity = orgIdentityFor('multi-dc')
    await t.withIdentity(identity).mutation(api.diveCenters.create, VALID_DC_ARGS)
    await t.withIdentity(identity).mutation(api.diveCenters.create, { ...VALID_DC_ARGS, name: 'Second DC' })

    const result = await t.withIdentity(identity).query(api.diveCenters.mine, {})
    expect(result).toHaveLength(2)
    const names = result.map((r) => r.name).sort()
    expect(names).toEqual(['Sairee Dive', 'Second DC'])
    expect(userId).toBeDefined()
  })
})

describe('diveCenters.archive', () => {
  it('soft-deletes the row and excludes it from mine + directory', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'arch-dc', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('arch-dc'))
      .mutation(api.diveCenters.archive, { entityId: dcId! })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(dcId!) as Doc<'diveCenters'> | null
      expect(row?.archivedAt).toBeTypeOf('number')
    })

    const mine = await t.withIdentity(orgIdentityFor('arch-dc')).query(api.diveCenters.mine, {})
    expect(mine).toEqual([])
  })

  it('rejects archive when caller does not own the row', async () => {
    const t = makeT()
    let dcId: Awaited<ReturnType<typeof seedDiveCenterProfile>> | undefined
    await t.run(async (ctx) => {
      const ownerId = await seedUser(ctx, 'arch-owner', 'DiveCenter')
      dcId = await seedDiveCenterProfile(ctx, ownerId)
      await seedUser(ctx, 'arch-attacker', 'DiveCenter')
    })

    await expect(
      t.withIdentity(orgIdentityFor('arch-attacker'))
        .mutation(api.diveCenters.archive, { entityId: dcId! }),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})
