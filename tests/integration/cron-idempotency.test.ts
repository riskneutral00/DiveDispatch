import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { seedUserWithOrg } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

describe('cron + backfill idempotency — running twice equals running once', () => {
  const PRIOR_ENV = process.env.ENVIRONMENT
  beforeAll(() => {
    process.env.ENVIRONMENT = 'development'
  })
  afterAll(() => {
    if (PRIOR_ENV === undefined) delete process.env.ENVIRONMENT
    else process.env.ENVIRONMENT = PRIOR_ENV
  })


  it('purgeStaleRateLimits: empty table is no-op; second run still no-op', async () => {
    const t = makeT()
    await t.mutation(internal.lib.rateLimiter.purgeStaleRateLimits, {})
    await t.mutation(internal.lib.rateLimiter.purgeStaleRateLimits, {})
    const remaining = await t.run(async (c) => c.db.query('rateLimits').collect())
    expect(remaining).toHaveLength(0)
  })

  it('purgeExpiredIdempotencyKeys: empty table is no-op; second run still no-op', async () => {
    const t = makeT()
    await t.mutation(internal.lib.idempotency.purgeExpiredIdempotencyKeys, {})
    await t.mutation(internal.lib.idempotency.purgeExpiredIdempotencyKeys, {})
    const remaining = await t.run(async (c) => c.db.query('idempotencyLog').collect())
    expect(remaining).toHaveLength(0)
  })

  it('backfillEntityProfileComplete: running twice returns same result shape', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserWithOrg(ctx, 'cron-eq', 'Equipment')
      const u = await ctx.db.get(userId)
      const orgId = u!.organizationId!
      await ctx.db.insert('equipment', {
        organizationId: orgId,
        slug: 'eq-cron',
        name: 'EQ Cron',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'eq-cron@example.com',
        phone: '+66812345678',
      })
    })

    const first = await t.mutation(internal.backfill.entityProfileComplete.backfillEntityProfileComplete, {})
    const second = await t.mutation(internal.backfill.entityProfileComplete.backfillEntityProfileComplete, {})
    expect(first).toEqual(second)
  })

  it('backfillEntitySlugs: idempotent — second run keeps slugs (no rewrites)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserWithOrg(ctx, 'cron-bs', 'Boat')
      const u = await ctx.db.get(userId)
      const orgId = u!.organizationId!
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'boat-cron',
        name: 'Cron Boat',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'b@example.com',
        phone: '+66812345678',
        fleet: [],
      })
    })

    const first = (await t.mutation(internal.backfill.entitySlugs.backfillEntitySlugs, {})) as Array<{ action: string }>
    const second = (await t.mutation(internal.backfill.entitySlugs.backfillEntitySlugs, {})) as Array<{ action: string }>
    expect(first.every((r) => r.action === 'kept' || r.action === 'set')).toBe(true)
    expect(second.every((r) => r.action === 'kept')).toBe(true)
  })
})

describe('cron observable post-conditions', () => {
  it('completeBookings on empty table: no exception', async () => {
    const t = makeT()
    await t.mutation(internal.bookings.status.completeBookingsWithMonitoring, {})
    const remaining = await t.run(async (c) => c.db.query('bookings').collect())
    expect(remaining).toHaveLength(0)
  })

  it('purgeSoftDeletedOrgs on empty table: no exception', async () => {
    const t = makeT()
    await t.mutation(internal.organizations.purgeSoftDeletedOrgs, {})
  })
})
