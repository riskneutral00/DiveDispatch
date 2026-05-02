import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { TEST_USER_REQUIRED } from './helpers/userDefaults'

describe('getActiveOrg — membership-gated denorm fallback', () => {
  it('(b) resolves user.organizationId when JWT has no orgId AND a matching userRoles row exists', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|free-with-role'

    const { orgId } = await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'free-slug',
        name: 'Free Personal',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'free-slug',
        email: 'free@test.com',
        firstName: 'Free',
        lastName: 'Lancer',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return { orgId: oid }
    })

    await t.withIdentity({ tokenIdentifier }).mutation(
      api.organizations.updateBusinessMetadata,
      { phone: '+66-80-000-0000' },
    )

    const org = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(org?.phone).toBe('+66-80-000-0000')
  })

  it('(b/seed) resolves a Clerk-bound org via denorm + userRoles when JWT has no orgId — covers seeded users with synthetic clerkOrgId', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|seed-style-user'

    const { orgId } = await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        clerkOrgId: 'seed_org_seed-slug',
        slug: 'seed-slug',
        name: 'Seed Org',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'seed-slug',
        email: 'seed@test.com',
        firstName: 'See',
        lastName: 'Eed',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return { orgId: oid }
    })

    await t.withIdentity({ tokenIdentifier }).mutation(
      api.organizations.updateBusinessMetadata,
      { phone: '+66-80-111-1111' },
    )

    const org = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(org?.phone).toBe('+66-80-111-1111')
  })

  it('(c) throws FORBIDDEN when user.organizationId is set but no userRoles row matches', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|denorm-no-role'

    await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'orphan-denorm',
        name: 'Orphan Org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'orphan-denorm',
        email: 'orphan-denorm@test.com',
        firstName: 'Or',
        lastName: 'Phan',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier }).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-555-0000' },
      ),
      'FORBIDDEN',
      'no_active_org',
    )
  })

  it('(d) throws FORBIDDEN when no JWT orgId AND no user.organizationId', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|no-denorm'

    await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'no-denorm',
        name: 'No Denorm Org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'no-denorm',
        email: 'no-denorm@test.com',
        firstName: 'No',
        lastName: 'Denorm',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier }).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-555-0000' },
      ),
      'FORBIDDEN',
      'no_active_org',
    )
  })

  it('(e) regression: JWT orgId claim resolves the matching Clerk-backed org when user has membership', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|jwt-org-user'
    const clerkOrgId = 'org_real_clerk_id'

    const { orgId } = await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        clerkOrgId,
        slug: 'jwt-org',
        name: 'JWT Org',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'jwt-user',
        email: 'jwt@test.com',
        firstName: 'J',
        lastName: 'WT',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return { orgId: oid }
    })

    await t.withIdentity({
      tokenIdentifier,
      orgId: clerkOrgId,
      orgRole: 'admin',
      orgSlug: 'jwt-org',
    }).mutation(
      api.organizations.updateBusinessMetadata,
      { phone: '+1-415-555-0100' },
    )

    const org = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(org?.phone).toBe('+1-415-555-0100')
  })

  it('(f) JWT orgId claim that resolves to no org falls through to membership-fallback', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|jwt-unresolvable'

    const { membershipOrgId } = await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        clerkOrgId: 'seed_org_jwt-fall',
        slug: 'jwt-fall',
        name: 'JWT Fall Org',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'jwt-fall',
        email: 'jwt-fall@test.com',
        firstName: 'JWT',
        lastName: 'Fall',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return { membershipOrgId: oid }
    })

    await t.withIdentity({
      tokenIdentifier,
      orgId: 'org_does_not_exist_in_db',
      orgRole: 'admin',
    }).mutation(
      api.organizations.updateBusinessMetadata,
      { phone: '+1-415-555-0200' },
    )

    const org = await t.run(async (ctx) => ctx.db.get(membershipOrgId))
    expect(org?.phone).toBe('+1-415-555-0200')
  })

  it('(g) JWT orgId claim that resolves to an org user has no membership in falls through to membership-fallback', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|jwt-wrong-org'
    const wrongClerkOrgId = 'org_wrong_clerk_id'

    const { membershipOrgId } = await t.run(async (ctx) => {
      const now = Date.now()
      const correctOrgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'seed_org_jwt-wrong',
        slug: 'jwt-wrong',
        name: 'Correct Org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('organizations', {
        clerkOrgId: wrongClerkOrgId,
        slug: 'wrong-clerk-org',
        name: 'Wrong Empty Org',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'jwt-wrong',
        email: 'jwt-wrong@test.com',
        firstName: 'JWT',
        lastName: 'Wrong',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: correctOrgId,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: correctOrgId,
        createdAt: now,
      })
      return { membershipOrgId: correctOrgId }
    })

    await t.withIdentity({
      tokenIdentifier,
      orgId: wrongClerkOrgId,
      orgRole: 'admin',
    }).mutation(
      api.organizations.updateBusinessMetadata,
      { phone: '+1-415-555-0300' },
    )

    const org = await t.run(async (ctx) => ctx.db.get(membershipOrgId))
    expect(org?.phone).toBe('+1-415-555-0300')
  })

  it('(h) membership-fallback path with permissionLevel: member rejects admin-only mutations', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|member-fallback'

    await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'member-fb',
        name: 'Member Org',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'member-fb',
        email: 'member-fb@test.com',
        firstName: 'Mem',
        lastName: 'Ber',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        permissionLevel: 'member',
        createdAt: now,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier }).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-415-555-0400' },
      ),
      'FORBIDDEN',
      'org_admin_required',
    )
  })

  it('(i) JWT-claim path narrows to member when membership permissionLevel is member, even if claim says admin', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|jwt-member'
    const clerkOrgId = 'org_member_jwt'

    await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        clerkOrgId,
        slug: 'jwt-member',
        name: 'JWT Member Org',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'jwt-member',
        email: 'jwt-member@test.com',
        firstName: 'JWT',
        lastName: 'Member',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oid,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        permissionLevel: 'member',
        createdAt: now,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier, orgId: clerkOrgId, orgRole: 'admin' }).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-415-555-0500' },
      ),
      'FORBIDDEN',
      'org_admin_required',
    )
  })
})
