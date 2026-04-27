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

  it('throws CONFLICT when target org is referenced by another orgs destinationIds', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'live-from-dest',
        name: 'Live From',
        clerkOrgId: 'org_from_dest',
        createdAt: now,
        updatedAt: now,
      })
      const targetId = await ctx.db.insert('organizations', {
        slug: 'target-dest',
        name: 'Target',
        clerkOrgId: 'org_target_dest',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('organizations', {
        slug: 'consumer-dest',
        name: 'Consumer',
        clerkOrgId: 'org_consumer_dest',
        createdAt: now,
        updatedAt: now,
        destinationIds: [targetId],
      })
    })

    await expectConvexError(
      t.mutation(api.admin.rebindOrgClerkOrgId.run, {
        fromClerkOrgId: 'org_from_dest',
        toClerkOrgId: 'org_target_dest',
      }),
      'CONFLICT',
    )

    const target = await t.run(async (ctx) =>
      ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', 'org_target_dest'))
        .unique(),
    )
    expect(target).not.toBeNull()
    expect(target?.deletedAt).toBeUndefined()
  })

  it('throws VALIDATION when fromClerkOrgId equals toClerkOrgId', async () => {
    const t = makeT()
    await expectConvexError(
      t.mutation(api.admin.rebindOrgClerkOrgId.run, {
        fromClerkOrgId: 'org_same',
        toClerkOrgId: 'org_same',
      }),
      'VALIDATION',
    )
  })

  it('throws when not in development environment', async () => {
    vi.stubEnv('ENVIRONMENT', 'production')
    const t = makeT()
    await expect(
      t.mutation(api.admin.rebindOrgClerkOrgId.run, {
        fromClerkOrgId: 'org_a',
        toClerkOrgId: 'org_b',
      }),
    ).rejects.toThrow()
  })
})
