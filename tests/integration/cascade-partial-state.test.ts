import { describe, it, expect } from 'vitest'
import { cascadeOrgDelete, TOMBSTONE_ORG_SLUG, getOrCreateTombstoneOrg } from '../../convex/lib/orgCascade'
import { seedUser, getOrCreateTestOrg } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

describe('cascadeOrgDelete — partial-state assertions', () => {
  it('moves users to tombstone org, deletes userRoles, deletes child rows', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'DiveCenter', slug: 'partial-cs' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'partial-cs')
      const dcId = await ctx.db.insert('diveCenters', {
        organizationId: orgId,
        slug: 'dc-partial',
        name: 'DC Partial',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'dc@example.com',
        phone: '+66812345678',
        associations: [],
      })

      const counts = await cascadeOrgDelete(ctx, orgId)
      expect(counts.usersUnbound).toBe(1)
      expect(counts.userRolesDeleted).toBeGreaterThan(0)
      expect(counts.profilesDeleted).toBeGreaterThan(0)

      const tombstone = await ctx.db
        .query('organizations')
        .withIndex('by_slug', (q) => q.eq('slug', TOMBSTONE_ORG_SLUG))
        .unique()
      expect(tombstone).not.toBeNull()

      const u = await ctx.db.get(userId)
      expect(u?.organizationId).toBe(tombstone!._id)

      const dc = await ctx.db.get(dcId)
      expect(dc).toBeNull()

      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect()
      expect(roles).toHaveLength(0)
    })
  })

  it('replay safety: cascade twice = no-op second time', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Boat', slug: 'replay-cs' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'replay-cs')
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'boat-replay',
        name: 'Boat Replay',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'b@example.com',
        phone: '+66812345678',
        fleet: [],
      })

      const first = await cascadeOrgDelete(ctx, orgId)
      const second = await cascadeOrgDelete(ctx, orgId)
      expect(first.usersUnbound).toBeGreaterThan(0)
      expect(second.usersUnbound).toBe(0)
      expect(second.userRolesDeleted).toBe(0)
      expect(second.profilesDeleted).toBe(0)
    })
  })

  it('tombstone slug __deleted__ is reserved (idempotent on getOrCreateTombstoneOrg)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const id1 = await getOrCreateTombstoneOrg(ctx)
      const id2 = await getOrCreateTombstoneOrg(ctx)
      expect(id1).toBe(id2)

      const found = await ctx.db
        .query('organizations')
        .withIndex('by_slug', (q) => q.eq('slug', TOMBSTONE_ORG_SLUG))
        .collect()
      expect(found).toHaveLength(1)
      expect(found[0].slug).toBe(TOMBSTONE_ORG_SLUG)
    })
  })

  it('new signup during cascade window: a user inserted into tombstone org survives the cascade window', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const aliceId = await seedUser(ctx, { role: 'DiveCenter', slug: 'alice-cs' })
      const orgId = await getOrCreateTestOrg(ctx, aliceId, 'alice-cs')

      await cascadeOrgDelete(ctx, orgId)

      const bobId = await seedUser(ctx, { role: 'Instructor', slug: 'bob-fresh' })
      const bob = await ctx.db.get(bobId)
      expect(bob).not.toBeNull()
      expect(bob!.organizationId).not.toBe(orgId)
    })
  })
})
