import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT, expectConvexError } from '../helpers/convex-helpers'

beforeEach(() => {
  vi.stubEnv('ENVIRONMENT', 'development')
})

describe('admin/rebindOrgClerkOrgId — soft-delete guard', () => {
  it('happy path: rebinds clerkOrgId on a live fromOrg and deletes the empty toOrg', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'live-from',
        name: 'Live From',
        clerkOrgId: 'org_old',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('organizations', {
        slug: 'empty-to',
        name: 'Empty To',
        clerkOrgId: 'org_new',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.mutation(api.admin.rebindOrgClerkOrgId.run, {
      fromClerkOrgId: 'org_old',
      toClerkOrgId: 'org_new',
    })

    expect(result.keptSlug).toBe('live-from')
    expect(result.newClerkOrgId).toBe('org_new')

    const reread = await t.run(async (ctx) =>
      ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', 'org_new'))
        .unique(),
    )
    expect(reread?.slug).toBe('live-from')
    expect(reread?.deletedAt).toBeUndefined()
  })

  it('throws VALIDATION when fromOrg is soft-deleted', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'soft-deleted-from',
        name: 'Soft Deleted',
        clerkOrgId: 'org_deleted',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      })
      await ctx.db.insert('organizations', {
        slug: 'empty-to',
        name: 'Empty To',
        clerkOrgId: 'org_new',
        createdAt: now,
        updatedAt: now,
      })
    })

    await expectConvexError(
      t.mutation(api.admin.rebindOrgClerkOrgId.run, {
        fromClerkOrgId: 'org_deleted',
        toClerkOrgId: 'org_new',
      }),
      'VALIDATION',
    )

    const stillBound = await t.run(async (ctx) =>
      ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', 'org_deleted'))
        .unique(),
    )
    expect(stillBound?.deletedAt).toBeDefined()
  })
})
