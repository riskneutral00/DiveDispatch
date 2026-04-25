import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT, expectConvexError } from '../helpers/convex-helpers'

beforeEach(() => {
  vi.stubEnv('ENVIRONMENT', 'development')
})

async function seedOrg(
  t: ReturnType<typeof makeT>,
  slug: string,
  overrides: Partial<{
    name: string
    isAreaOrg: boolean | undefined
    clerkOrgId: string | undefined
    destinationIds: string[] | undefined
  }> = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('organizations', {
      name: overrides.name ?? 'Test Org',
      slug,
      isAreaOrg: overrides.isAreaOrg,
      clerkOrgId: overrides.clerkOrgId,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('api.admin.promoteAreaOrg.run', () => {
  it('flips isAreaOrg from undefined to true', async () => {
    const t = makeT()
    const orgId = await seedOrg(t, 'phuket-test')

    const result = await t.mutation(api.admin.promoteAreaOrg.run, {
      slug: 'phuket-test',
    })

    expect(result.isAreaOrg).toBe(true)
    expect(result.orgId).toBe(orgId)
    expect(result.slug).toBe('phuket-test')

    const fresh = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(fresh?.isAreaOrg).toBe(true)
  })

  it('is idempotent — already-true stays true and updatedAt advances', async () => {
    const t = makeT()
    const orgId = await seedOrg(t, 'already-area', { isAreaOrg: true })
    const before = await t.run(async (ctx) => ctx.db.get(orgId))

    await new Promise((r) => setTimeout(r, 5))
    const result = await t.mutation(api.admin.promoteAreaOrg.run, {
      slug: 'already-area',
    })

    expect(result.isAreaOrg).toBe(true)

    const after = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(after?.isAreaOrg).toBe(true)
    expect(after?.updatedAt).toBeGreaterThan(before!.updatedAt)
  })

  it('throws NOT_FOUND for missing slug', async () => {
    const t = makeT()
    await expectConvexError(
      t.mutation(api.admin.promoteAreaOrg.run, { slug: 'does-not-exist' }),
      'NOT_FOUND',
    )
  })

  it('does not touch other org fields', async () => {
    const t = makeT()
    const orgId = await seedOrg(t, 'preserve-fields', {
      name: 'Original Name',
      clerkOrgId: 'org_abc123',
    })
    const before = await t.run(async (ctx) => ctx.db.get(orgId))

    await t.mutation(api.admin.promoteAreaOrg.run, { slug: 'preserve-fields' })

    const after = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(after?.name).toBe(before?.name)
    expect(after?.clerkOrgId).toBe(before?.clerkOrgId)
    expect(after?.createdAt).toBe(before?.createdAt)
    expect(after?.slug).toBe(before?.slug)
  })
})
