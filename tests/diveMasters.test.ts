import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'DiveMaster' | 'DiveCenter' = 'DiveMaster') {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
}

async function seedDiveMasterProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: { teachingLanguages?: string[] } = {},
) {
  return ctx.db.insert('diveMasters', {
    userId,
    name: 'Test DiveMaster',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    email: 'dm@test.com',
    phone: '+66123456789',
    credential: [{ agency: 'PADI', level: 'DM', agencyID: '77777' }],
    teachingLanguages: overrides.teachingLanguages ?? ['en'],
    verified: true,
  })
}

describe('diveMasters.update — monotonic profileComplete invariant', () => {
  it('allows clearing teachingLanguages while profileComplete is false (draft)', async () => {
    const t = makeT()
    let dmId: Awaited<ReturnType<typeof seedDiveMasterProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'draft-dm')
      dmId = await seedDiveMasterProfile(ctx, userId, { teachingLanguages: ['en'] })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|draft-dm' })
      .mutation(api.diveMasters.update, { teachingLanguages: [] })

    await t.run(async (ctx) => {
      const dm = await ctx.db.get(dmId!) as Doc<'diveMasters'> | null
      expect(dm!.teachingLanguages).toEqual([])
    })
  })

  it('rejects clearing teachingLanguages once profileComplete is true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'done-dm')
      await seedDiveMasterProfile(ctx, userId, { teachingLanguages: ['th', 'en'] })
      const rr = await ctx.db.query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      await ctx.db.patch(rr!._id, { profileComplete: true })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|done-dm' })
        .mutation(api.diveMasters.update, { teachingLanguages: [] }),
    ).rejects.toThrow(/PROFILE_INCOMPLETE/)
  })

  it('allows updates that keep all required fields satisfied', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'happy-dm')
      await seedDiveMasterProfile(ctx, userId, { teachingLanguages: ['en'] })
      const rr = await ctx.db.query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      await ctx.db.patch(rr!._id, { profileComplete: true })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|happy-dm' })
      .mutation(api.diveMasters.update, { teachingLanguages: ['th', 'en'] })
  })
})

describe('directory.listByRole — DiveMaster picker gate', () => {
  it('excludes diveMasters with empty teachingLanguages array', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-dm', 'DiveCenter')
      const u1 = await seedUser(ctx, 'dm-empty', 'DiveMaster')
      await seedDiveMasterProfile(ctx, u1, { teachingLanguages: [] })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|caller-dm' })
      .query(api.directory.listByRole, { role: 'DiveMaster' })
    expect(result).toHaveLength(0)
  })

  it('includes diveMasters with at least one teachingLanguage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-dm2', 'DiveCenter')
      const u1 = await seedUser(ctx, 'dm-ok', 'DiveMaster')
      await seedDiveMasterProfile(ctx, u1, { teachingLanguages: ['th'] })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|caller-dm2' })
      .query(api.directory.listByRole, { role: 'DiveMaster' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('dm-ok')
  })
})
