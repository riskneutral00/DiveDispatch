import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, seedBoatProfile, seedEquipmentProfile, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'
import type { Id } from '../convex/_generated/dataModel'

async function addRole(
  ctx: SeedCtx,
  userId: Id<'users'>,
  role: 'Venue' | 'Boat' | 'Equipment' | 'Compressor' | 'Instructor',
) {
  const user = await ctx.db.get(userId)
  if (!user?.organizationId) throw new Error('user has no org')
  await ctx.db.insert('userRoles', {
    userId,
    role,
    organizationId: user.organizationId,
    permissionLevel: 'admin',
    createdAt: Date.now(),
  })
  return user.organizationId
}

async function insertVenue(ctx: SeedCtx, orgId: Id<'organizations'>, slug: string) {
  return ctx.db.insert('venues', {
    organizationId: orgId,
    slug,
    name: slug,
    kind: 'pool',
    address: { city: 'Koh Tao', country: 'TH' },
    lat: 10,
    lng: 99,
    features: [],
    verified: true,
  })
}

async function insertCompressor(ctx: SeedCtx, orgId: Id<'organizations'>, slug: string) {
  return ctx.db.insert('compressors', {
    organizationId: orgId,
    slug,
    name: slug,
    address: { city: 'Koh Tao', country: 'TH' },
    lat: 10,
    lng: 99,
    email: `${slug}@t.com`,
    phone: '+66000',
    gasMixes: ['air'],
    verified: true,
  })
}

function args(overrides: Record<string, unknown> = {}) {
  return {
    activeRole: 'DiveCenter' as const,
    autoAccept: true as const,
    confirmOnAccept: false,
    confirmOnDecline: false,
    ...overrides,
  }
}

describe('stakeholderPreferences.upsert — first-creation autofill', () => {
  it('autofills all five arrays from self-owned resources when args are undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        slug: 'sea-fun',
        tokenIdentifier: 'clerk|sea-fun',
        role: 'DiveCenter',
      })
      const orgId = await addRole(ctx, userId, 'Venue')
      await addRole(ctx, userId, 'Boat')
      await addRole(ctx, userId, 'Equipment')
      await addRole(ctx, userId, 'Compressor')
      await addRole(ctx, userId, 'Instructor')

      await insertVenue(ctx, orgId, 'sf-pool')
      await seedBoatProfile(ctx, userId, { organizationId: orgId, slug: 'sf-boat' })
      await seedEquipmentProfile(ctx, userId, { organizationId: orgId, slug: 'sf-eq' })
      await insertCompressor(ctx, orgId, 'sf-comp')
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|sea-fun' }).mutation(
      api.stakeholderPreferences.upsert,
      args(),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|sea-fun' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs).not.toBeNull()
    expect(prefs!.preferredVenueSlugs).toEqual(['sf-pool'])
    expect(prefs!.preferredBoatSlugs).toEqual(['sf-boat'])
    expect(prefs!.preferredEquipmentSlugs).toEqual(['sf-eq'])
    expect(prefs!.preferredCompressorSlugs).toEqual(['sf-comp'])
    expect(prefs!.preferredInstructorSlugs).toEqual(['sea-fun'])
  })

  it('explicit non-undefined args win over autofill', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        slug: 'sea-fun-2',
        tokenIdentifier: 'clerk|sea-fun-2',
        role: 'DiveCenter',
      })
      const orgId = await addRole(ctx, userId, 'Venue')
      await addRole(ctx, userId, 'Boat')
      await insertVenue(ctx, orgId, 'self-pool')
      await seedBoatProfile(ctx, userId, { organizationId: orgId, slug: 'self-boat' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|sea-fun-2' }).mutation(
      api.stakeholderPreferences.upsert,
      args({ preferredVenueSlugs: ['external-pool'] }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|sea-fun-2' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredVenueSlugs).toEqual(['external-pool'])
    expect(prefs!.preferredBoatSlugs).toEqual(['self-boat'])
  })

  it('second upsert (row exists) leaves new arrays undefined; autofill is creation-only', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        slug: 'second-up',
        tokenIdentifier: 'clerk|second-up',
        role: 'DiveCenter',
      })
      const orgId = await addRole(ctx, userId, 'Venue')
      await insertVenue(ctx, orgId, 'self-v')
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|second-up' }).mutation(
      api.stakeholderPreferences.upsert,
      args({ preferredVenueSlugs: ['explicit-v'] }),
    )

    await t.withIdentity({ tokenIdentifier: 'clerk|second-up' }).mutation(
      api.stakeholderPreferences.upsert,
      args(),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|second-up' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredVenueSlugs).toBeUndefined()
  })

  it('user with no owned resources autofills to empty arrays', async () => {
    const t = makeT()
    await t.run(async (ctx) =>
      seedUser(ctx, {
        slug: 'bare-dc',
        tokenIdentifier: 'clerk|bare-dc',
        role: 'DiveCenter',
      }),
    )

    await t.withIdentity({ tokenIdentifier: 'clerk|bare-dc' }).mutation(
      api.stakeholderPreferences.upsert,
      args(),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|bare-dc' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredVenueSlugs).toEqual([])
    expect(prefs!.preferredBoatSlugs).toEqual([])
    expect(prefs!.preferredInstructorSlugs).toEqual([])
  })

  it('Instructor role autofills to [user.slug]', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'solo-instr',
        tokenIdentifier: 'clerk|solo-instr',
        role: 'Instructor',
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|solo-instr' }).mutation(
      api.stakeholderPreferences.upsert,
      args({ activeRole: 'Instructor' }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|solo-instr' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredInstructorSlugs).toEqual(['solo-instr'])
  })

  it('explicit empty array is respected (autofill skipped)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        slug: 'opt-out',
        tokenIdentifier: 'clerk|opt-out',
        role: 'DiveCenter',
      })
      const orgId = await addRole(ctx, userId, 'Venue')
      await insertVenue(ctx, orgId, 'owned-v')
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|opt-out' }).mutation(
      api.stakeholderPreferences.upsert,
      args({ preferredVenueSlugs: [] }),
    )

    const prefs = await t.withIdentity({ tokenIdentifier: 'clerk|opt-out' }).query(
      api.stakeholderPreferences.mine,
      {},
    )
    expect(prefs!.preferredVenueSlugs).toEqual([])
  })
})
