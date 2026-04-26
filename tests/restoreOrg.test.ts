import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

describe('admin/restoreOrg — recover a soft-deleted org within the 7-day window', () => {
  const PRIOR_ENV = process.env.ENVIRONMENT
  beforeAll(() => {
    process.env.ENVIRONMENT = 'development'
  })
  afterAll(() => {
    if (PRIOR_ENV === undefined) delete process.env.ENVIRONMENT
    else process.env.ENVIRONMENT = PRIOR_ENV
  })

  it('clears deletedAt within window and writes org_cascade_restored audit entry', async () => {
    const t = makeT()
    const orgId = await t.run(async (ctx) => {
      const now = Date.now()
      return ctx.db.insert('organizations', {
        slug: 'restore-me',
        name: 'Restore Me',
        clerkOrgId: 'org_restore',
        deletedAt: now - 1000,
        createdAt: now - 2000,
        updatedAt: now - 1000,
      })
    })

    const result = await t.mutation(api.admin.restoreOrg.run, { orgSlug: 'restore-me' })
    expect(result.restored).toBe(true)

    const org = await t.run(async (ctx) => ctx.db.get(orgId))
    expect(org?.deletedAt).toBeUndefined()

    const auditCount = await t.run(async (ctx) =>
      (await ctx.db.query('webhookAuditLog').collect()).filter((e) => e.eventType === 'org_cascade_restored').length,
    )
    expect(auditCount).toBe(1)
  })

  it('throws restore_window_elapsed when deletedAt is older than 7 days', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'expired-restore',
        name: 'Too Late',
        clerkOrgId: 'org_expired',
        deletedAt: now - SEVEN_DAYS_MS - 60_000,
        createdAt: now - SEVEN_DAYS_MS - 120_000,
        updatedAt: now - SEVEN_DAYS_MS - 60_000,
      })
    })

    await expectConvexError(
      t.mutation(api.admin.restoreOrg.run, { orgSlug: 'expired-restore' }),
      'VALIDATION',
      'restore_window_elapsed',
    )
  })

  it('returns restored=false when org is already active (not soft-deleted)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: 'already-active',
        name: 'Active',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.mutation(api.admin.restoreOrg.run, { orgSlug: 'already-active' })
    expect(result.restored).toBe(false)
  })

  it('throws NOT_FOUND for unknown slug', async () => {
    const t = makeT()
    await expectConvexError(
      t.mutation(api.admin.restoreOrg.run, { orgSlug: 'nope-not-here' }),
      'NOT_FOUND',
    )
  })
})
