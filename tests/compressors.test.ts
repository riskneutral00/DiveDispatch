import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'Compressor' | 'DiveCenter' = 'Compressor') {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
}

async function seedCompressorProfile(ctx: SeedCtx, userId: Awaited<ReturnType<typeof seedUser>>) {
  return ctx.db.insert('compressors', {
    userId,
    name: 'Test Compressor',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.09,
    lng: 99.84,
    email: 'compressor@test.com',
    phone: '+66123456789',
    verified: true,
  })
}

const VALID_ARGS = {
  name: 'Sairee Compressor',
  placeName: 'Koh Tao',
  country: 'Thailand',
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
      t.withIdentity({ tokenIdentifier: 'clerk|dc-user' }).mutation(api.compressors.create, VALID_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates compressor profile', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'comp-owner') })

    const compId = await t.withIdentity({ tokenIdentifier: 'clerk|comp-owner' })
      .mutation(api.compressors.create, VALID_ARGS)

    expect(typeof compId).toBe('string')
    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId as Id<'compressors'>) as Doc<'compressors'> | null
      expect(comp).not.toBeNull()
      expect(comp!.name).toBe('Sairee Compressor')
      expect(comp!.userId).toEqual(userId)
      expect(comp!.verified).toBe(false)
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-comp') })
    const identity = { tokenIdentifier: 'clerk|dup-comp' }

    const id1 = await t.withIdentity(identity).mutation(api.compressors.create, VALID_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.compressors.create, { ...VALID_ARGS, name: 'Other' })
    expect(id1).toBe(id2)
  })
})

describe('compressors.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.compressors.update, { name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-comp') })
    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|no-comp' }).mutation(api.compressors.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates compressor fields', async () => {
    const t = makeT()
    let compId: Awaited<ReturnType<typeof seedCompressorProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-comp')
      compId = await seedCompressorProfile(ctx, userId)
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|upd-comp' })
      .mutation(api.compressors.update, { name: 'Updated Compressor' })

    await t.run(async (ctx) => {
      const comp = await ctx.db.get(compId!) as Doc<'compressors'> | null
      expect(comp!.name).toBe('Updated Compressor')
      expect(comp!.email).toBe('compressor@test.com')
    })
  })
})

describe('directory.listByRole — Compressor picker gate', () => {
  it('excludes compressors with undefined gasMixes', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-comp', 'DiveCenter')
      const u1 = await seedUser(ctx, 'comp-undef', 'Compressor')
      await ctx.db.insert('compressors', {
        userId: u1,
        name: 'Undef', placeName: 'Chalong', country: 'Thailand',
        lat: 7.82, lng: 98.36, email: 'u@t.com', phone: '+66000',
        verified: true,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|caller-comp' })
      .query(api.directory.listByRole, { role: 'Compressor' })
    expect(result).toHaveLength(0)
  })

  it('excludes compressors with empty gasMixes array', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-comp2', 'DiveCenter')
      const u1 = await seedUser(ctx, 'comp-empty', 'Compressor')
      await ctx.db.insert('compressors', {
        userId: u1,
        name: 'Empty', placeName: 'Chalong', country: 'Thailand',
        lat: 7.82, lng: 98.36, email: 'e@t.com', phone: '+66000',
        gasMixes: [],
        verified: true,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|caller-comp2' })
      .query(api.directory.listByRole, { role: 'Compressor' })
    expect(result).toHaveLength(0)
  })

  it('includes compressors with at least one gasMix', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-comp3', 'DiveCenter')
      const u1 = await seedUser(ctx, 'comp-ok', 'Compressor')
      await ctx.db.insert('compressors', {
        userId: u1,
        name: 'Air Shop', placeName: 'Chalong', country: 'Thailand',
        lat: 7.82, lng: 98.36, email: 'a@t.com', phone: '+66000',
        gasMixes: ['air'],
        verified: true,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|caller-comp3' })
      .query(api.directory.listByRole, { role: 'Compressor' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('comp-ok')
  })
})

describe('compressors.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.compressors.mine, {})).toBeNull()
  })

  it('returns null when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-comp-profile') })
    expect(
      await t.withIdentity({ tokenIdentifier: 'clerk|no-comp-profile' }).query(api.compressors.mine, {}),
    ).toBeNull()
  })

  it('returns compressor profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-comp')
      await seedCompressorProfile(ctx, userId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|my-comp' }).query(api.compressors.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Compressor')
  })
})

describe('compressors nitrox range validation', () => {
  it('accepts valid nitrox range on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-ok') })

    const compId = await t.withIdentity({ tokenIdentifier: 'clerk|nitrox-ok' })
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
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-low') })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|nitrox-low' })
        .mutation(api.compressors.create, { ...VALID_ARGS, nitroxMin: 15 }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('rejects nitroxMax above 40 on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-high') })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|nitrox-high' })
        .mutation(api.compressors.create, { ...VALID_ARGS, nitroxMax: 50 }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('rejects nitroxMin > nitroxMax on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'nitrox-inv') })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|nitrox-inv' })
        .mutation(api.compressors.create, { ...VALID_ARGS, nitroxMin: 36, nitroxMax: 28 }),
    ).rejects.toThrow(/VALIDATION/)
  })

  it('rejects out-of-range nitrox on update', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'nitrox-upd')
      await seedCompressorProfile(ctx, userId)
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|nitrox-upd' })
        .mutation(api.compressors.update, { nitroxMin: 50 }),
    ).rejects.toThrow(/VALIDATION/)
  })
})
