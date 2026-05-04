import { describe, it, expect } from 'vitest'
import { recomputeRoleProfileComplete } from '../../convex/lib/setRoleProfileComplete'
import { seedUser, getOrCreateTestOrg } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

describe('recomputeRoleProfileComplete — strict-AND semantics across entity rows', () => {
  it('returns false when any of N entity rows is incomplete (mixed-completion)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Boat', slug: 'mixed-boat' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'mixed-boat')
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'b1',
        name: 'B1',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'b1@example.com',
        phone: '+66812345678',
        fleet: [
          { boatName: 'B1', maxPax: 20, boatType: 'day_boat' as const },
        ],
        profileComplete: true,
      })
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'b2',
        name: 'B2',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'b2@example.com',
        phone: '+66812345678',
        fleet: [],
        profileComplete: false,
      })

      const result = await recomputeRoleProfileComplete(ctx, userId, 'Boat')
      expect(result).toBe(false)
    })
  })

  it('returns false when zero entity rows exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Equipment', slug: 'zero-rows' })
      await getOrCreateTestOrg(ctx, userId, 'zero-rows')
      const result = await recomputeRoleProfileComplete(ctx, userId, 'Equipment')
      expect(result).toBe(false)
    })
  })

  it('archived rows are excluded from completeness computation (archived-only org returns no-rows-false)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Boat', slug: 'archived-only-cs' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'archived-only-cs')
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'dead-only',
        name: 'Archived Only',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'dead@example.com',
        phone: '+66812345678',
        fleet: [{ boatName: 'Dead', maxPax: 20, boatType: 'day_boat' as const }],
        profileComplete: true,
        archivedAt: Date.now(),
      })

      const result = await recomputeRoleProfileComplete(ctx, userId, 'Boat')
      expect(result).toBe(false)
    })
  })

  it('person role completeness flows through checkProfileCompleteness', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor', slug: 'person-cs' })
      const result = await recomputeRoleProfileComplete(ctx, userId, 'Instructor')
      expect(typeof result).toBe('boolean')
    })
  })
})

describe('recomputeRoleProfileComplete — drift detection vs denorm', () => {
  it('returns the live truth (false for incomplete boat) even when userRoles.profileComplete denorm is stale-true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Boat', slug: 'stale-boat' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'stale-boat')
      await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'b-incomplete',
        name: 'Incomplete',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'f@example.com',
        phone: '+66812345678',
        fleet: [],
        profileComplete: false,
      })

      const userRolesRows = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect()
      const boatRow = userRolesRows.find((r) => r.role === 'Boat')!
      await ctx.db.patch(boatRow._id, { profileComplete: true })

      const live = await recomputeRoleProfileComplete(ctx, userId, 'Boat')
      expect(live).toBe(false)

      const denormAfter = await ctx.db.get(boatRow._id)
      expect(denormAfter!.profileComplete).toBe(true)
    })
  })
})
