import { describe, it, expect } from 'vitest'
import { cascadeOrgDelete } from '../convex/lib/orgCascade'
import { seedUser, getOrCreateTestOrg } from './fixtures'
import { makeT } from './helpers/convex-helpers'

describe('cascadeOrgDelete — inventoryUnits sweep', () => {
  it('deletes Venue inventoryUnits owned by venues in the deleted org', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Venue', slug: 'venue-casc' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'venue-casc')
      const venueId = await ctx.db.insert('venues', {
        organizationId: orgId,
        name: 'Casc Pool', slug: 'casc-pool',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10, lng: 99, subtype: 'pool',
        hasCompressor: false, verified: true,
      })
      await ctx.db.insert('inventoryUnits', {
        resourceType: 'Venue',
        resourceId: 'casc-pool',
        displayName: 'Casc Pool',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'casc-pool',
        ownerType: 'Venue',
      })

      await cascadeOrgDelete(ctx, orgId)

      const remainingVenue = await ctx.db.get(venueId)
      const remainingUnits = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'casc-pool').eq('ownerType', 'Venue'),
        )
        .collect()
      expect(remainingVenue).toBeNull()
      expect(remainingUnits).toHaveLength(0)
    })
  })

  it('deletes Boat + Equipment + Compressor inventoryUnits owned by users in the deleted org', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Boat', slug: 'multi-casc' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'multi-casc')

      for (const ownerType of ['Boat', 'Equipment', 'Compressor'] as const) {
        await ctx.db.insert('inventoryUnits', {
          resourceType: ownerType,
          resourceId: 'multi-casc',
          displayName: `${ownerType} Unit`,
          capacityModel: 'Pooled',
          totalUnits: 5,
          ownerId: 'multi-casc',
          ownerType,
        })
      }

      await cascadeOrgDelete(ctx, orgId)

      const remaining = await ctx.db.query('inventoryUnits').collect()
      expect(remaining).toHaveLength(0)
    })
  })
})
