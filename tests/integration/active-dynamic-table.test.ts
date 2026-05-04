import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { seedUserWithOrg } from '../fixtures'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'

describe('queryActiveDynamicTable — chain composition + archivedAt filter', () => {
  it('user-facing read excludes archived rows from boats.mine', async () => {
    const t = makeT()
    const slug = 'qa-boat'
    await t.run(async (ctx) => {
      const userId: Id<'users'> = await seedUserWithOrg(ctx, slug, 'Boat')
      const u = await ctx.db.get(userId)
      const orgId = u!.organizationId!
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'live-boat',
        name: 'Live Boat',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'live@example.com',
        phone: '+66812345678',
        fleet: [],
      })
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'archived-boat',
        name: 'Archived Boat',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'archived@example.com',
        phone: '+66812345678',
        fleet: [],
        archivedAt: Date.now(),
      })
    })

    const visible = await t.withIdentity(orgIdentityFor(slug)).query(api.boats.mine, {})
    const slugs = (visible as Array<{ slug: string }>).map((r) => r.slug).sort()
    expect(slugs).toEqual(['live-boat'])
  })
})
