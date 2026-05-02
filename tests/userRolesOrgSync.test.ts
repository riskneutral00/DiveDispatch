import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { TEST_USER_REQUIRED } from './helpers/userDefaults'
import type { Id } from '../convex/_generated/dataModel'

describe('userRoles.organizationId stays in sync with users.organizationId', () => {
  it('1 — webhook patching creator org also stamps the creator\'s pre-existing roles', async () => {
    const t = makeT()
    const issuer = 'https://test.clerk.accounts.dev'
    const tokenIdentifier = `${issuer}|user_rene`

    const { userId } = await t.run(async (ctx) => {
      const personalOrg = await ctx.db.insert('organizations', {
        slug: 'rene',
        name: 'Rene Personal',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'rene',
        email: 'rene@test.com',
        firstName: 'Rene',
        lastName: 'Balot',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: personalOrg,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: personalOrg,
        createdAt: Date.now(),
      })
      return { userId: uid }
    })

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: 'org_real',
      name: 'Sea Fun Divers',
      slug: 'sea-fun-divers',
      creatorTokenIdentifier: tokenIdentifier,
    })

    await t.run(async (ctx) => {
      const clerkOrg = await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', 'org_real'))
        .unique()
      expect(clerkOrg).toBeTruthy()
      const user = await ctx.db.get(userId)
      expect(user?.organizationId).toBe(clerkOrg!._id)
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect()
      expect(roles).toHaveLength(1)
      expect(roles[0].organizationId).toBe(clerkOrg!._id)
    })
  })

  // (former test 2 "addRole throws if user has no active org" deleted post-DD-543:
  // users.organizationId is now required at the schema level, so the no-org state
  // is structurally impossible. The defensive `!user.organizationId` branch in
  // userRoles.addRole remains as belt-and-suspenders but is no longer reachable
  // from the test harness.)

  it('3 — addRole stamps the role with the user\'s current org', async () => {
    const t = makeT()
    const tokenIdentifier = 'https://test.clerk.accounts.dev|user_hasorg'

    let orgId: Id<'organizations'>
    await t.run(async (ctx) => {
      orgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_hasorg',
        slug: 'hasorg-co',
        name: 'Has Org Co',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'hasorg',
        email: 'hasorg@test.com',
        firstName: 'Has',
        lastName: 'Org',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: orgId,
      })
    })

    const asUser = t.withIdentity({ tokenIdentifier, subject: tokenIdentifier })
    await asUser.mutation(api.userRoles.addRole, { role: 'Compressor' })

    await t.run(async (ctx) => {
      const roles = await ctx.db.query('userRoles').collect()
      expect(roles).toHaveLength(1)
      expect(roles[0].organizationId).toBe(orgId)
      expect(roles[0].role).toBe('Compressor')
    })
  })

  it('4a — createUser existing-user rebinding to Clerk org re-syncs pre-existing userRoles', async () => {
    const t = makeT()
    const issuer = 'https://test.clerk.accounts.dev'
    const tokenIdentifier = `${issuer}|user_rebinder`

    const { userId, personalOrgId, clerkOrgId } = await t.run(async (ctx) => {
      const personalId = await ctx.db.insert('organizations', {
        slug: 'rebinder',
        name: 'Re Binder Personal',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'rebinder',
        email: 'rebinder@test.com',
        firstName: 'Re',
        lastName: 'Binder',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: personalId,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'Compressor',
        organizationId: personalId,
        createdAt: Date.now(),
      })
      const clerkId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_rebinder',
        slug: 'rebinder-co',
        name: 'Rebinder Co',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      return { userId: uid, personalOrgId: personalId, clerkOrgId: clerkId }
    })

    const asUser = t.withIdentity({
      tokenIdentifier,
      subject: tokenIdentifier,
      email: 'rebinder@test.com',
      orgId: 'org_rebinder',
      orgRole: 'admin',
      orgSlug: 'rebinder-co',
    } as unknown as Parameters<typeof t.withIdentity>[0])
    await asUser.mutation(api.users.createUser, {
      role: 'DiveCenter',
      roles: ['DiveCenter'],
      firstName: 'Re',
      lastName: 'Binder',
      dateOfBirth: '1990-01-01',
      tcAccepted: true,
      tcVersion: 'v1',
      phone: '+66812345678',
    })

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user!.organizationId).toBe(clerkOrgId)
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect()
      expect(roles).toHaveLength(2)
      for (const r of roles) {
        expect(r.organizationId).toBe(clerkOrgId)
      }
      expect(personalOrgId).not.toBe(clerkOrgId)
    })
  })

  it('4 — createUser new-user flow stamps role with personal org when no Clerk org claim', async () => {
    const t = makeT()
    const tokenIdentifier = 'https://test.clerk.accounts.dev|user_fresh'

    const asUser = t.withIdentity({
      tokenIdentifier,
      subject: tokenIdentifier,
      email: 'fresh@test.com',
    })
    await asUser.mutation(api.users.createUser, {
      role: 'Compressor',
      roles: ['Compressor'],
      firstName: 'Fresh',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      tcAccepted: true,
      tcVersion: 'v1',
      phone: '+66812345678',
    })

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
        .unique()
      expect(user?.organizationId).toBeDefined()
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', user!._id))
        .collect()
      expect(roles).toHaveLength(1)
      expect(roles[0].organizationId).toBe(user!.organizationId)
    })
  })
})
