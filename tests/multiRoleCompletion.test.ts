import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  seedUser,
  seedDiveCenterProfile,
  seedBookingTemplate,
  seedStakeholderPreferences,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Composite helper: 100% DiveCenter profile ─────────────────────────────

async function seedCompleteDC(ctx: SeedCtx, slug: string) {
  const userId = await seedUser(ctx, {
    slug,
    tokenIdentifier: `clerk|${slug}`,
    role: 'DiveCenter',
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
  })
  await seedDiveCenterProfile(ctx, userId, {
    name: 'Test DC',
    contactEmail: 'dc@test.com',
  })
  await seedBookingTemplate(ctx, {
    ownerId: slug,
    ownerType: 'DiveCenter',
    name: 'DSD',
    activityType: ['DSD'],
  })
  await seedStakeholderPreferences(ctx, slug, {
    stakeholderType: 'DiveCenter',
    preferredInstructorSlugs: ['inst-1'],
  })
  return userId
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getLowestProfileCompletion', () => {
  it('single-role user returns that role percentage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCompleteDC(ctx, 'dc-single')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-single' })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(100)
  })

  it('multi-role user returns the lowest percentage across roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedCompleteDC(ctx, 'dc-multi')

      // Add Boat role — no boat profile exists → 0%
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        createdAt: Date.now(),
        profileComplete: false,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-multi' })
      .query(api.users.getLowestProfileCompletion, {})

    // DC is 100%, Boat is 0% (no profile) → min is 0%
    expect(result.percentage).toBe(0)
  })

  it('multi-role user with all profiles complete returns 100%', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedCompleteDC(ctx, 'dc-all-done')

      // Add Boat role with complete profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        createdAt: Date.now(),
        profileComplete: false,
      })

      await ctx.db.insert('boats', {
        userId,
        name: 'Test Boat Biz',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10.09,
        lng: 99.84,
        contactEmail: 'boat@test.com',
        contactPhone: '+66111111111',
        fleet: [{ boatName: 'Dive Boat 1', maxPax: 12, boatType: 'day_boat' }],
        hasCompressor: false,
        verified: false,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-all-done' })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(100)
  })
})

// ─── getAllRolesCompleteness ────────────────────────────────────────────────

describe('getAllRolesCompleteness', () => {
  it('single-role user returns one entry with correct percentage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCompleteDC(ctx, 'dc-all-single')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-all-single' })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(true)
    expect(result.roles).toHaveLength(1)
    expect(result.roles[0].role).toBe('DiveCenter')
    expect(result.roles[0].percentage).toBe(100)
    expect(result.roles[0].incomplete).toHaveLength(0)
  })

  it('multi-role user with mixed completion returns allComplete: false', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedCompleteDC(ctx, 'dc-all-mixed')

      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        createdAt: Date.now(),
        profileComplete: false,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-all-mixed' })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(false)
    expect(result.roles).toHaveLength(2)

    const dc = result.roles.find((r: { role: string }) => r.role === 'DiveCenter')
    const boat = result.roles.find((r: { role: string }) => r.role === 'Boat')
    expect(dc!.percentage).toBe(100)
    expect(boat!.percentage).toBe(0)
    expect(boat!.incomplete).toContain('Business name')
  })

  it('multi-role user all complete returns allComplete: true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedCompleteDC(ctx, 'dc-all-both')

      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        createdAt: Date.now(),
        profileComplete: false,
      })

      await ctx.db.insert('boats', {
        userId,
        name: 'Complete Boat',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10.09,
        lng: 99.84,
        contactEmail: 'boat@test.com',
        contactPhone: '+66111111111',
        fleet: [{ boatName: 'Dive Boat 1', maxPax: 12, boatType: 'day_boat' }],
        hasCompressor: false,
        verified: false,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-all-both' })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(true)
    expect(result.roles).toHaveLength(2)
    expect(result.roles.every((r: { percentage: number }) => r.percentage === 100)).toBe(true)
  })

  it('returns empty roles when no userRoles rows exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCompleteDC(ctx, 'dc-no-roles')

      // Delete all userRoles for this user
      const roles = await ctx.db
        .query('userRoles')
        .collect()
      for (const r of roles) {
        if (r.role === 'DiveCenter') {
          await ctx.db.delete(r._id)
        }
      }
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|dc-no-roles' })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(true)
    expect(result.roles).toHaveLength(0)
  })
})
