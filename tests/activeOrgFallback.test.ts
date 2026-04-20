import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'

describe('getActiveOrg — user.organizationId fallback', () => {
  it('resolves to personal org when JWT has no orgId but user.organizationId is set', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|freelance-user'

    const { userId, orgId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        originalTokenIdentifier: tokenIdentifier,
        slug: 'free-slug',
        email: 'free@test.com',
        name: 'Free',
        firstName: 'Free',
        lastName: 'Lancer',
        appLanguage: 'en',
      })
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'free-slug',
        name: 'Free Personal',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(uid, { organizationId: oid })
      return { userId: uid, orgId: oid }
    })

    // updateBusinessMetadata calls requireOrgAdmin → getActiveOrg. Success path proves the fallback works.
    await t.withIdentity({ tokenIdentifier }).mutation(
      api.organizations.updateBusinessMetadata,
      { phone: '+66-80-000-0000' },
    )

    const org = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(org?.phone).toBe('+66-80-000-0000')
    expect(userId).toBeDefined()
  })

  it('still throws FORBIDDEN when no JWT orgId AND no user.organizationId', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|orphan-user'

    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier,
        originalTokenIdentifier: tokenIdentifier,
        slug: 'orphan-slug',
        email: 'orphan@test.com',
        name: 'Orphan',
        firstName: 'Or',
        lastName: 'Phan',
        appLanguage: 'en',
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier }).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-555-0000' },
      ),
      'FORBIDDEN',
    )
  })

  it('refuses to grant admin when user.organizationId points at a Clerk-backed org (no JWT claim)', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|confused-deputy'

    await t.run(async (ctx) => {
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        originalTokenIdentifier: tokenIdentifier,
        slug: 'deputy-slug',
        email: 'deputy@test.com',
        name: 'Deputy',
        firstName: 'De',
        lastName: 'Puty',
        appLanguage: 'en',
      })
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_clerk_backed',
        slug: 'clerk-backed-slug',
        name: 'Clerk-Backed Org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(uid, { organizationId: oid })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier }).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-555-0000' },
      ),
      'FORBIDDEN',
    )
  })
})
