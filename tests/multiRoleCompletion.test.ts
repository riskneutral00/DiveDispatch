import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  seedUser,
  seedEquipmentProfile,
  seedCompleteGearInventory,
  getOrCreateTestOrg,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Composite helper: 100% Equipment profile (simplest role) ─────────────

async function seedCompleteEquipment(ctx: SeedCtx, slug: string) {
  const userId = await seedUser(ctx, {
    slug,
    tokenIdentifier: `clerk|${slug}`,
    role: 'Equipment',
    email: `${slug}@test.com`,
    firstName: slug,
    lastName: 'Test',
  })
  // Set profile-layer and settings-layer fields on users table
  await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
  await seedEquipmentProfile(ctx, userId)
  await seedCompleteGearInventory(ctx, slug)
  return userId
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getLowestProfileCompletion', () => {
  it('single-role user returns that role percentage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCompleteEquipment(ctx, 'eq-single')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|eq-single' })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(100)
  })

  it('multi-role user returns the lowest percentage across roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedCompleteEquipment(ctx, 'eq-multi')
      const user = await ctx.db.get(userId)

      // Add Boat role -- no boat profile exists
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        organizationId: user!.organizationId!,
        createdAt: Date.now(),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|eq-multi' })
      .query(api.users.getLowestProfileCompletion, {})

    // Equipment is 100%, Boat has no profile -> some fields missing
    expect(result.percentage).toBeLessThan(100)
  })

  it('multi-role user with all profiles complete returns 100%', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedCompleteEquipment(ctx, 'eq-all-done')
      const organizationId = await getOrCreateTestOrg(ctx, userId, 'Test Boat Biz')

      // Add Boat role with complete profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        organizationId,
        createdAt: Date.now(),
      })
      const venueId = await ctx.db.insert('venues', {
        organizationId,
        slug: 'eq-all-done-venue',
        name: 'Eq All Done Venue',
        kind: 'dive_site',
        features: ['reef'],
        confinedCapable: false,
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10.09,
        lng: 99.84,
        verified: true,
      })
      await ctx.db.insert('boats', {
        organizationId,
        slug: 'boat-test-biz',
        name: 'Test Boat Biz',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10.09,
        lng: 99.84,
        email: 'boat@test.com',
        phone: '+66111111111',
        fleet: [{ boatName: 'Dive Boat 1', maxPax: 12, boatType: 'day_boat', routes: [{ venueIds: [venueId], daysOfWeek: [1] }] }],
        verified: false,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|eq-all-done' })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(100)
  })
})

// ─── getAllRolesCompleteness ────────────────────────────────────────────────

describe('getAllRolesCompleteness', () => {
  it('single-role user returns one entry with correct percentage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCompleteEquipment(ctx, 'eq-all-single')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|eq-all-single' })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(true)
    expect(result.roles).toHaveLength(1)
    expect(result.roles[0].role).toBe('Equipment')
    expect(result.roles[0].percentage).toBe(100)
    expect(result.roles[0].incomplete).toHaveLength(0)
  })

  it('multi-role user with mixed completion returns allComplete: false', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedCompleteEquipment(ctx, 'eq-all-mixed')
      const user = await ctx.db.get(userId)

      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        organizationId: user!.organizationId!,
        createdAt: Date.now(),
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|eq-all-mixed' })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(false)
    expect(result.roles).toHaveLength(2)

    const eq = result.roles.find((r: { role: string }) => r.role === 'Equipment')
    const boat = result.roles.find((r: { role: string }) => r.role === 'Boat')
    expect(eq!.percentage).toBe(100)
    expect(boat!.percentage).toBeLessThan(100)
    expect(boat!.incomplete).toContain('name')
  })

  it('returns empty roles when no userRoles rows exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCompleteEquipment(ctx, 'eq-no-roles')

      // Delete all userRoles for this user
      const roles = await ctx.db
        .query('userRoles')
        .collect()
      for (const r of roles) {
        await ctx.db.delete(r._id)
      }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|eq-no-roles' })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(true)
    expect(result.roles).toHaveLength(0)
  })
})
