import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser as _seedUser, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'Equipment' | 'DiveCenter' = 'Equipment') {
  const userId = await _seedUser(ctx, {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    role,
  })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

describe('equipment.visibleToMe — destination-scoped discovery', () => {
  it('returns own-org + destination-org equipment for an operator with destinationIds', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const areaId = await ctx.db.insert('organizations', {
        slug: 'south-andaman',
        name: 'South Andaman',
        isAreaOrg: true,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('equipment', {
        organizationId: areaId,
        name: 'Area Equipment',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'area-e@test.com',
        phone: '+66110000000',
        verified: true,
      })
      const operatorId = await seedUser(ctx, 'rene-eq-vis')
      const user = await ctx.db.get(operatorId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.patch(user.organizationId, { destinationIds: [areaId] })
      await ctx.db.insert('equipment', {
        organizationId: user.organizationId,
        name: 'Rene Equipment',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'rene-e@test.com',
        phone: '+66120000000',
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('rene-eq-vis')).query(api.equipment.visibleToMe, {})
    expect(results.map((e) => e.name).sort()).toEqual(['Area Equipment', 'Rene Equipment'])
  })

  it('returns own-org equipment only when destinationIds is undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'solo-eq-vis')
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.insert('equipment', {
        organizationId: user.organizationId,
        name: 'Solo Equipment',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10,
        lng: 99,
        email: 'solo-e@test.com',
        phone: '+66130000000',
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('solo-eq-vis')).query(api.equipment.visibleToMe, {})
    expect(results.map((e) => e.name)).toEqual(['Solo Equipment'])
  })

  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    expect(await t.query(api.equipment.visibleToMe, {})).toEqual([])
  })
})
