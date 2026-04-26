import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import { seedUserWithOrg } from '../fixtures'

describe('backfillEntitySlugs — dev-only migration to seed slugs on entity rows', () => {
  const PRIOR_ENV = process.env.ENVIRONMENT
  beforeAll(() => {
    process.env.ENVIRONMENT = 'development'
  })
  afterAll(() => {
    if (PRIOR_ENV === undefined) delete process.env.ENVIRONMENT
    else process.env.ENVIRONMENT = PRIOR_ENV
  })

  it('keeps existing slugs unchanged and is idempotent', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserWithOrg(ctx, 'idem-dc', 'DiveCenter')
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) throw new Error('no org')
      await ctx.db.insert('diveCenters', {
        organizationId: user.organizationId,
        slug: 'dc-prebaked',
        name: 'Prebaked DC',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'pb@test.com',
        phone: '+66110000000',
        associations: [],
        verified: true,
      })
    })

    const first = await t.mutation(internal.backfill.entitySlugs.backfillEntitySlugs, {})
    const second = await t.mutation(internal.backfill.entitySlugs.backfillEntitySlugs, {})

    const dcRow = first.find((r) => r.table === 'diveCenters')
    expect(dcRow?.action).toBe('kept')
    expect(dcRow?.slug).toBe('dc-prebaked')
    expect(second.find((r) => r.table === 'diveCenters')?.action).toBe('kept')
  })

  it('refuses outside dev', async () => {
    process.env.ENVIRONMENT = 'production'
    const t = makeT()
    await expect(
      t.mutation(internal.backfill.entitySlugs.backfillEntitySlugs, {}),
    ).rejects.toBeDefined()
    process.env.ENVIRONMENT = 'development'
  })
})
