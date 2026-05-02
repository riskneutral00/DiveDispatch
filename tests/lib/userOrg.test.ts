import { describe, it, expect } from 'vitest'
import { setUserOrganization } from '../../convex/lib/userOrg'
import { makeT } from '../helpers/convex-helpers'
import { TEST_USER_REQUIRED } from '../helpers/userDefaults'

describe('setUserOrganization — single-writer invariant', () => {
  it('patches user.organizationId and keeps userRoles in sync', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const oldOrg = await ctx.db.insert('organizations', {
        slug: 'old-org',
        name: 'Old Org',
        createdAt: now,
        updatedAt: now,
      })
      const newOrg = await ctx.db.insert('organizations', {
        slug: 'new-org',
        name: 'New Org',
        createdAt: now,
        updatedAt: now,
      })
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|sync-user',
        slug: 'sync-user',
        email: 'sync@test.com',
        firstName: 'Sync',
        lastName: 'User',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: oldOrg,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId: oldOrg,
        createdAt: now,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId: oldOrg,
        createdAt: now,
      })

      await setUserOrganization(ctx, userId, newOrg)

      const user = await ctx.db.get(userId)
      expect(user?.organizationId).toBe(newOrg)
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect()
      expect(roles).toHaveLength(2)
      for (const r of roles) {
        expect(r.organizationId).toBe(newOrg)
      }
    })
  })

  it('re-syncs drift: a stale userRole gets patched back to the user org', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const orgA = await ctx.db.insert('organizations', {
        slug: 'org-a',
        name: 'Org A',
        createdAt: now,
        updatedAt: now,
      })
      const orgB = await ctx.db.insert('organizations', {
        slug: 'org-b',
        name: 'Org B',
        createdAt: now,
        updatedAt: now,
      })
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|drift-user',
        slug: 'drift-user',
        email: 'drift@test.com',
        firstName: 'Drift',
        lastName: 'User',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: orgA,
      })
      const role1 = await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId: orgA,
        createdAt: now,
      })
      const role2 = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId: orgA,
        createdAt: now,
      })

      await ctx.db.patch(role2, { organizationId: orgB })

      await setUserOrganization(ctx, userId, orgA)

      const user = await ctx.db.get(userId)
      expect(user?.organizationId).toBe(orgA)
      const r1 = await ctx.db.get(role1)
      const r2 = await ctx.db.get(role2)
      expect(r1?.organizationId).toBe(orgA)
      expect(r2?.organizationId).toBe(orgA)
    })
  })

  it('is a no-op when user and all roles already match the target org', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const orgId = await ctx.db.insert('organizations', {
        slug: 'noop-org',
        name: 'Noop Org',
        createdAt: now,
        updatedAt: now,
      })
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|noop-user',
        slug: 'noop-user',
        email: 'noop@test.com',
        firstName: 'Noop',
        lastName: 'User',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: orgId,
      })
      const roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId: orgId,
        createdAt: now,
      })

      await setUserOrganization(ctx, userId, orgId)

      const user = await ctx.db.get(userId)
      expect(user?.organizationId).toBe(orgId)
      const r = await ctx.db.get(roleId)
      expect(r?.organizationId).toBe(orgId)
    })
  })
})
