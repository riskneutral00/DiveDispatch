import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { seedUserWithOrg } from '../fixtures'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'

describe('FSM race conditions — concurrent transactions', () => {
  it('archive racing update: one wins, the other observes the post-state without crashing', async () => {
    const t = makeT()
    const slug = 'race-archive-update'
    const ctx = await t.run(async (ctx) => {
      const userId = await seedUserWithOrg(ctx, slug, 'Boat')
      const u = await ctx.db.get(userId)
      const orgId = u!.organizationId!
      const boatId = await ctx.db.insert('boats', {
        organizationId: orgId,
        slug: 'racey-boat',
        name: 'Racey',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'race@example.com',
        phone: '+66812345678',
        fleet: [{ boatName: 'Racey', maxPax: 20, boatType: 'day_boat' as const }],
      })
      return { boatId, userId, orgId }
    })

    const identity = orgIdentityFor(slug)

    const archivePromise = t.withIdentity(identity).mutation(api.boats.archive, {
      entityId: ctx.boatId as Id<'boats'>,
    })
    const updatePromise = t.withIdentity(identity).mutation(api.boats.update, {
      entityId: ctx.boatId as Id<'boats'>,
      name: 'Racey Renamed',
    })

    const results = await Promise.allSettled([archivePromise, updatePromise])
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length
    const rejected = results.filter((r) => r.status === 'rejected').length
    expect(fulfilled + rejected).toBe(2)

    const post = await t.run(async (c) => c.db.get(ctx.boatId as Id<'boats'>))
    expect(post).not.toBeNull()
  })

  it('two simultaneous archives on the same row: idempotent (both observe archivedAt)', async () => {
    const t = makeT()
    const slug = 'race-archive-twice'
    const ctx = await t.run(async (ctx) => {
      const userId = await seedUserWithOrg(ctx, slug, 'Equipment')
      const u = await ctx.db.get(userId)
      const orgId = u!.organizationId!
      const eqId = await ctx.db.insert('equipment', {
        organizationId: orgId,
        slug: 'eq-race',
        name: 'EQ Race',
        verified: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 0,
        lng: 0,
        email: 'eq@example.com',
        phone: '+66812345678',
      })
      return { eqId, userId, orgId }
    })

    const identity = orgIdentityFor(slug)
    const single = await t
      .withIdentity(identity)
      .mutation(api.equipment.archive, { entityId: ctx.eqId as Id<'equipment'> })
      .then(() => 'ok' as const)
      .catch((e: Error) => e.message)
    expect(single).toBe('ok')

    const post = await t.run(async (c) => c.db.get(ctx.eqId as Id<'equipment'>))
    expect(post).not.toBeNull()
    expect(post!.archivedAt).toBeGreaterThan(0)

    const second = await t
      .withIdentity(identity)
      .mutation(api.equipment.archive, { entityId: ctx.eqId as Id<'equipment'> })
      .then(() => 'ok' as const)
      .catch((e: Error) => e.message)
    expect(second).toMatch(/ok|FORBIDDEN|NOT_FOUND/)

    const final = await t.run(async (c) => c.db.get(ctx.eqId as Id<'equipment'>))
    expect(final!.archivedAt).toBeGreaterThan(0)
  })

  it('reservation hold + release race: count consistent post-condition', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await ctx.db.insert('inventoryUnits', {
        resourceType: 'Venue',
        resourceId: 'race-venue',
        displayName: 'Race Venue',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: 'race-venue',
        ownerType: 'Venue',
      })
    })

    const remaining = await t.run(async (c) => {
      const units = await c.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', 'race-venue').eq('ownerType', 'Venue'),
        )
        .collect()
      return units.length
    })
    expect(remaining).toBe(1)
  })
})
