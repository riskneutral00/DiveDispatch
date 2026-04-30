import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, seedInstructorProfile, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedIncompleteCompressor(ctx: SeedCtx, slug: string) {
  const userId = await seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, role: 'Compressor', email: `${slug}@test.com` })
  const orgId = await getOrCreateTestOrg(ctx, userId, slug)
  await ctx.db.insert('compressors', { slug,
    organizationId: orgId,
    name: slug,
    address: { city: 'Koh Tao', country: 'TH' },
    lat: 10, lng: 99, email: `${slug}@t.com`, phone: '+66000',
    gasMixes: [],
    verified: true,
  })
  return userId
}

async function seedCompleteCompressor(ctx: SeedCtx, slug: string) {
  const userId = await seedIncompleteCompressor(ctx, slug)
  const orgId = (await ctx.db.get(userId))!.organizationId!
  const comp = await ctx.db.query('compressors').withIndex('by_organizationId', (q) => q.eq('organizationId', orgId)).unique()
  await ctx.db.patch(comp!._id, { gasMixes: ['air'] })
  const row = await ctx.db.query('userRoles').withIndex('by_userId_role', (q) => q.eq('userId', userId).eq('role', 'Compressor')).unique()
  await ctx.db.patch(row!._id, { profileComplete: true })
  return userId
}

describe('Rule 12 — cross-org discovery readiness', () => {
  it('directory.listByRole excludes Compressor with profileComplete !== true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-caller', tokenIdentifier: 'clerk|dc-caller', role: 'DiveCenter' })
      await seedIncompleteCompressor(ctx, 'comp-incomplete')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-caller' })
      .query(api.directory.listByRole, { role: 'Compressor' })
    expect(result).toHaveLength(0)
  })

  it('directory.listByRole includes Compressor with profileComplete === true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-caller-ok', tokenIdentifier: 'clerk|dc-caller-ok', role: 'DiveCenter' })
      await seedCompleteCompressor(ctx, 'comp-ready')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-caller-ok' })
      .query(api.directory.listByRole, { role: 'Compressor' })
    expect(result.map((r) => r.slug)).toContain('comp-ready')
  })

  it('stakeholderPreferences.upsert rejects incomplete compressor slug', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-writer', tokenIdentifier: 'clerk|dc-writer', role: 'DiveCenter' })
      await seedIncompleteCompressor(ctx, 'comp-bad')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-writer' }).mutation(api.stakeholderPreferences.upsert, {
        activeRole: 'DiveCenter',
        autoAccept: true,
        confirmOnAccept: true,
        confirmOnDecline: true,
        preferredCompressorSlugs: ['comp-bad'],
      }),
    ).rejects.toThrow(/PROFILE_INCOMPLETE/)
  })

  it('stakeholderPreferences.upsert accepts complete compressor slug', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-writer-ok', tokenIdentifier: 'clerk|dc-writer-ok', role: 'DiveCenter' })
      await seedCompleteCompressor(ctx, 'comp-good')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-writer-ok' }).mutation(api.stakeholderPreferences.upsert, {
        activeRole: 'DiveCenter',
        autoAccept: true,
        confirmOnAccept: true,
        confirmOnDecline: true,
        preferredCompressorSlugs: ['comp-good'],
      }),
    ).resolves.toBeDefined()
  })

  it('togglePreferredInstructor rejects adding incomplete instructor', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-toggle', tokenIdentifier: 'clerk|dc-toggle', role: 'DiveCenter' })
      const incompleteInstrId = await seedUser(ctx, { slug: 'inst-incomplete', tokenIdentifier: 'clerk|inst-incomplete', role: 'Instructor', email: 'i@t.com' })
      await seedInstructorProfile(ctx, incompleteInstrId, { teachingLanguages: [] })
      const row = await ctx.db.query('userRoles').withIndex('by_userId_role', (q) => q.eq('userId', incompleteInstrId).eq('role', 'Instructor')).unique()
      if (row) await ctx.db.patch(row._id, { profileComplete: false })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-toggle' }).mutation(api.directory.togglePreferredInstructor, {
        activeRole: 'DiveCenter',
        instructorSlug: 'inst-incomplete',
      }),
    ).rejects.toThrow(/PROFILE_INCOMPLETE/)
  })

  it('togglePreferredInstructor allows removing previously-added instructor even if now incomplete', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-unstar', tokenIdentifier: 'clerk|dc-unstar', role: 'DiveCenter' })
      const instrId = await seedUser(ctx, { slug: 'inst-stale', tokenIdentifier: 'clerk|inst-stale', role: 'Instructor', email: 'i@t.com' })
      await seedInstructorProfile(ctx, instrId)
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'dc-unstar',
        stakeholderType: 'DiveCenter',
        autoAccept: true,
        useNamedUnits: false,
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['inst-stale'],
      })
      const row = await ctx.db.query('userRoles').withIndex('by_userId_role', (q) => q.eq('userId', instrId).eq('role', 'Instructor')).unique()
      if (row) await ctx.db.patch(row._id, { profileComplete: false })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-unstar' }).mutation(api.directory.togglePreferredInstructor, {
      activeRole: 'DiveCenter',
      instructorSlug: 'inst-stale',
    })
    expect(result.starred).toBe(false)
  })
})
