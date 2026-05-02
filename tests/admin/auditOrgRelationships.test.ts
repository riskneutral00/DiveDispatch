import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import { TEST_USER_REQUIRED } from '../helpers/userDefaults'

beforeEach(() => {
  vi.stubEnv('ENVIRONMENT', 'development')
})

async function seedCleanGraph(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const orgId = await ctx.db.insert('organizations', {
      name: 'Sea Fun Divers',
      slug: 'sea-fun-divers',
      clerkOrgId: 'org_real_clerk',
      createdAt: now,
      updatedAt: now,
    })
    const userId = await ctx.db.insert('users', {
      slug: 'rene',
      tokenIdentifier: 'clerk|rene',
      email: 'rene@example.com',
      firstName: 'Rene',
      lastName: 'Balot',
      appLanguage: 'en',
      organizationId: orgId,
      ...TEST_USER_REQUIRED,
    })
    await ctx.db.insert('userRoles', {
      userId,
      role: 'DiveCenter',
      createdAt: now,
      organizationId: orgId,
    })
    return { orgId, userId }
  })
}

describe('api.admin.auditOrgRelationships.run', () => {
  it('returns ok: true for a clean graph', async () => {
    const t = makeT()
    await seedCleanGraph(t)

    const result = await t.query(api.admin.auditOrgRelationships.run, {})

    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
    expect(result.summary.users).toBe(1)
    expect(result.summary.orgs).toBe(1)
    expect(result.summary.roles).toBe(1)
  })

  it('detects orphan user.organizationId (invariant 1)', async () => {
    const t = makeT()
    await seedCleanGraph(t)

    await t.run(async (ctx) => {
      const now = Date.now()
      const ghostOrgId = await ctx.db.insert('organizations', {
        name: 'Ghost Org',
        slug: 'ghost-org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        slug: 'orphan',
        tokenIdentifier: 'clerk|orphan',
        email: 'orphan@example.com',
        firstName: 'Orphan',
        lastName: 'User',
        appLanguage: 'en',
        organizationId: ghostOrgId,
        ...TEST_USER_REQUIRED,
      })
      await ctx.db.delete(ghostOrgId)
    })

    const result = await t.query(api.admin.auditOrgRelationships.run, {})

    expect(result.ok).toBe(false)
    expect(result.violations.some((vio) => vio.invariant === '1')).toBe(true)
  })

  it('detects sync violations between user.organizationId and userRoles.organizationId (invariant 3)', async () => {
    const t = makeT()
    const { userId } = await seedCleanGraph(t)

    await t.run(async (ctx) => {
      const now = Date.now()
      const otherOrgId = await ctx.db.insert('organizations', {
        name: 'Other Org',
        slug: 'other-org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Compressor',
        createdAt: now,
        organizationId: otherOrgId,
      })
    })

    const result = await t.query(api.admin.auditOrgRelationships.run, {})

    expect(result.ok).toBe(false)
    expect(result.violations.some((v) => v.invariant === '3')).toBe(true)
  })

  it('detects ghost seed orgs (invariant 5)', async () => {
    const t = makeT()
    await seedCleanGraph(t)

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        name: 'Ghost Seed',
        slug: 'ghost-seed',
        clerkOrgId: 'seed_org_phantom',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.query(api.admin.auditOrgRelationships.run, {})

    expect(result.ok).toBe(false)
    expect(result.violations.some((v) => v.invariant === '5')).toBe(true)
  })
})
