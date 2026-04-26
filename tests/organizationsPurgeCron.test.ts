import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { makeT } from './helpers/convex-helpers'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

async function seedSoftDeletedOrgWithChildren(
  t: ReturnType<typeof makeT>,
  ageMs: number,
): Promise<{ orgId: Id<'organizations'>; userId: Id<'users'> }> {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const orgId = await ctx.db.insert('organizations', {
      slug: 'purge-target',
      name: 'Purge Target',
      clerkOrgId: 'org_purge_target',
      deletedAt: now - ageMs,
      createdAt: now - ageMs - 1000,
      updatedAt: now - ageMs,
    })
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|purge-user',
      originalTokenIdentifier: 'clerk|purge-user',
      slug: 'purge-user',
      email: 'purge@test.com',
      name: 'Purge User',
      firstName: 'Purge',
      lastName: 'User',
      appLanguage: 'en',
      organizationId: orgId,
    })
    await ctx.db.insert('userRoles', {
      userId,
      role: 'DiveCenter',
      organizationId: orgId,
      permissionLevel: 'admin',
      createdAt: now - ageMs,
    })
    await ctx.db.insert('diveCenters', {
      organizationId: orgId,
      name: 'Purge DC',
      address: { city: 'Phuket', country: 'TH' },
      lat: 7.88,
      lng: 98.39,
      email: 'dc@test.com',
      phone: '+66800000003',
      associations: [],
      verified: false,
    })
    return { orgId, userId }
  })
}

describe('organizations.purgeSoftDeletedOrgs cron', () => {
  it('hard-deletes orgs whose deletedAt is older than 7 days, cascading children', async () => {
    const t = makeT()
    const { orgId, userId } = await seedSoftDeletedOrgWithChildren(t, SEVEN_DAYS_MS + 60_000)

    const result = await t.mutation(internal.organizations.purgeSoftDeletedOrgs, {})
    expect(result.purged).toBe(1)

    const { org, user, role, dc } = await t.run(async (ctx) => ({
      org: await ctx.db.get(orgId),
      user: await ctx.db.get(userId),
      role: (await ctx.db.query('userRoles').withIndex('by_organizationId', (q) => q.eq('organizationId', orgId)).first()),
      dc: (await ctx.db.query('diveCenters').withIndex('by_organizationId', (q) => q.eq('organizationId', orgId)).first()),
    }))

    expect(org).toBeNull()
    expect(role).toBeNull()
    expect(dc).toBeNull()
    expect(user?.organizationId).toBeUndefined()
  })

  it('leaves orgs whose deletedAt is within the 7-day window untouched', async () => {
    const t = makeT()
    const { orgId } = await seedSoftDeletedOrgWithChildren(t, SEVEN_DAYS_MS - 60_000)

    const result = await t.mutation(internal.organizations.purgeSoftDeletedOrgs, {})
    expect(result.purged).toBe(0)

    const org = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(org).not.toBeNull()
    expect(org?.deletedAt).toBeTypeOf('number')
  })

  it('leaves active (non-deleted) orgs untouched', async () => {
    const t = makeT()
    const orgId = await t.run(async (ctx) => {
      const now = Date.now()
      return ctx.db.insert('organizations', {
        slug: 'active-org',
        name: 'Active Org',
        clerkOrgId: 'org_active',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.mutation(internal.organizations.purgeSoftDeletedOrgs, {})
    expect(result.purged).toBe(0)

    const org = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(org).not.toBeNull()
  })

  it('is idempotent on re-run (already-purged orgs are gone, second run is a no-op)', async () => {
    const t = makeT()
    await seedSoftDeletedOrgWithChildren(t, SEVEN_DAYS_MS + 60_000)

    const first = await t.mutation(internal.organizations.purgeSoftDeletedOrgs, {})
    const second = await t.mutation(internal.organizations.purgeSoftDeletedOrgs, {})

    expect(first.purged).toBe(1)
    expect(second.purged).toBe(0)
  })
})
