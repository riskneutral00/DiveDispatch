import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'

describe('admin/bindOrgClerkOrgId — patch Convex org clerkOrgId by slug', () => {
  const PRIOR_ENV = process.env.ENVIRONMENT
  beforeAll(() => {
    process.env.ENVIRONMENT = 'development'
  })
  afterAll(() => {
    if (PRIOR_ENV === undefined) delete process.env.ENVIRONMENT
    else process.env.ENVIRONMENT = PRIOR_ENV
  })

  it('happy path: patches an unbound org from undefined to a real clerkOrgId', async () => {
    const t = makeT()

    const orgId = await t.run(async (ctx) => {
      const now = Date.now()
      return ctx.db.insert('organizations', {
        slug: 'happy-bind',
        name: 'Happy Bind',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.mutation(api.admin.bindOrgClerkOrgId.run, {
      orgSlug: 'happy-bind',
      clerkOrgId: 'org_real_clerk_id',
    })

    expect(result.changed).toBe(true)
    expect(result.orgId).toBe(orgId)
    expect(result.clerkOrgId).toBe('org_real_clerk_id')

    const reread = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(reread?.clerkOrgId).toBe('org_real_clerk_id')
  })

  it('idempotent: same clerkOrgId is a no-op', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'noop-bind',
        name: 'Noop Bind',
        clerkOrgId: 'org_already_bound',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.mutation(api.admin.bindOrgClerkOrgId.run, {
      orgSlug: 'noop-bind',
      clerkOrgId: 'org_already_bound',
    })

    expect(result.changed).toBe(false)
    expect(result.clerkOrgId).toBe('org_already_bound')
  })

  it('conflict: different existing clerkOrgId throws CONFLICT', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'conflict-bind',
        name: 'Conflict Bind',
        clerkOrgId: 'org_existing',
        createdAt: now,
        updatedAt: now,
      })
    })

    await expectConvexError(
      t.mutation(api.admin.bindOrgClerkOrgId.run, {
        orgSlug: 'conflict-bind',
        clerkOrgId: 'org_different',
      }),
      'CONFLICT',
    )
  })

  it('not-found: missing slug throws NOT_FOUND', async () => {
    const t = makeT()

    await expectConvexError(
      t.mutation(api.admin.bindOrgClerkOrgId.run, {
        orgSlug: 'does-not-exist',
        clerkOrgId: 'org_anything',
      }),
      'NOT_FOUND',
    )
  })
})
