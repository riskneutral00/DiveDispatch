import { describe, it, expect, beforeEach } from 'vitest'
import { checkProfileCompleteness, checkAllRolesCompleteness } from '../convex/lib/profileCompleteness'
import { api } from '../convex/_generated/api'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedDiveCenterProfile,
  seedAgent,
  seedInstructorProfile,
  seedBoatProfile,
  seedEquipmentProfile,
  seedBookingTemplate,
  seedStakeholderPreferences,
} from './fixtures/seedFixture'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── checkProfileCompleteness per-role accuracy ──────────────────────────────

describe('checkProfileCompleteness', () => {
  it('DiveCenter with all 9 fields returns 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })

      const user = await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.diveCenter)).unique()
      const result = await checkProfileCompleteness(ctx, user!)

      expect(result.percentage).toBe(100)
      expect(result.incomplete).toHaveLength(0)
    })
  })

  it('DiveCenter missing template + prefs returns 75%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      // No template, no preferences → missing "Quick Book pill" + "Preferred instructors"

      const user = await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.diveCenter)).unique()
      const result = await checkProfileCompleteness(ctx, user!)

      expect(result.percentage).toBe(75)
      expect(result.incomplete).toContain('Quick Book pill')
      expect(result.incomplete).toContain('Preferred instructors')
    })
  })

  it('Instructor with all 7 fields returns 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      await seedInstructorProfile(ctx, userId)

      const user = await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.instructor)).unique()
      const result = await checkProfileCompleteness(ctx, user!)

      expect(result.percentage).toBe(100)
      expect(result.incomplete).toHaveLength(0)
    })
  })

  it('Instructor missing credentials returns correct %', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      await seedInstructorProfile(ctx, userId, {
        credential: [],
      })

      const user = await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.instructor)).unique()
      const result = await checkProfileCompleteness(ctx, user!)

      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('Credentials')
    })
  })

  it('Boat with no profile record returns 0%', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: 'boat-owner',
        role: 'Boat',
      })

      const user = await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', 'boat-owner')).unique()
      const result = await checkProfileCompleteness(ctx, user!)

      expect(result.percentage).toBe(0)
      expect(result.incomplete.length).toBeGreaterThan(0)
    })
  })

  it('Agent location uses locations[0].placeName', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: 'agent-loc',
        role: 'Agent',
      })
      // seedAgent sets locations: [{ placeName: 'Koh Tao', country: 'Thailand', ... }]
      await seedAgent(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: 'agent-loc',
        ownerType: 'Agent',
      })
      await seedStakeholderPreferences(ctx, 'agent-loc', {
        stakeholderType: 'Agent',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })

      const user = await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', 'agent-loc')).unique()
      const result = await checkProfileCompleteness(ctx, user!)

      // Agent uses locations[0].placeName and locations[0].country instead of flat placeName/country
      expect(result.incomplete).not.toContain('Location')
      expect(result.incomplete).not.toContain('Country')
      expect(result.percentage).toBe(100)
    })
  })
})

// ─── getLowestProfileCompletion query ────────────────────────────────────────

describe('getLowestProfileCompletion', () => {
  it('single role at 100% returns percentage: 100', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(100)
  })

  it('single role at 75% returns percentage: 78', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      // No template + no prefs → 75%
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(75)
  })

  it('multi-role (DC 100% + Boat 0%) returns the minimum (0)', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })
      // Add Boat role with no profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        isPrimary: false,
        createdAt: Date.now(),
        profileComplete: false,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(0)
  })

  it('multi-role (DC 100% + Instructor 100%) returns 100', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })
      // Add Instructor role with complete profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        isPrimary: false,
        createdAt: Date.now(),
        profileComplete: false,
      })
      await seedInstructorProfile(ctx, userId)
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getLowestProfileCompletion, {})

    expect(result.percentage).toBe(100)
  })

  it('user with no userRoles falls back to primary role check', async () => {
    await t.run(async (ctx) => {
      // seedUser creates a userRoles entry by default. Use skipUserRoles to test fallback.
      await seedUser(ctx, { skipUserRoles: true })
      await seedDiveCenterProfile(ctx, await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.diveCenter)).unique().then((u: any) => u!._id))
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getLowestProfileCompletion, {})

    // Falls back to user.role (DiveCenter), profile exists but no template/prefs → 75%
    expect(result.percentage).toBe(75)
  })
})

// ─── checkAllRolesCompleteness ───────────────────────────────────────────────

describe('checkAllRolesCompleteness', () => {
  it('single role at 100% returns allComplete: true', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })

      const result = await checkAllRolesCompleteness(ctx, userId)

      expect(result.allComplete).toBe(true)
      expect(result.roles).toHaveLength(1)
      expect(result.roles[0].percentage).toBe(100)
    })
  })

  it('multi-role (DC 100% + Boat 0%) returns allComplete: false', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })
      // Add Boat role with no profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        isPrimary: false,
        createdAt: Date.now(),
        profileComplete: false,
      })

      const result = await checkAllRolesCompleteness(ctx, userId)

      expect(result.allComplete).toBe(false)
      expect(result.roles).toHaveLength(2)
      const boatRole = result.roles.find(r => r.role === 'Boat')
      expect(boatRole?.percentage).toBe(0)
      expect(boatRole?.incomplete.length).toBeGreaterThan(0)
    })
  })

  it('multi-role all complete returns allComplete: true', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })
      // Add Instructor role with complete profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        isPrimary: false,
        createdAt: Date.now(),
        profileComplete: false,
      })
      await seedInstructorProfile(ctx, userId)

      const result = await checkAllRolesCompleteness(ctx, userId)

      expect(result.allComplete).toBe(true)
      expect(result.roles.every(r => r.percentage === 100)).toBe(true)
    })
  })
})

// ─── getAllRolesCompleteness query ────────────────────────────────────────────

describe('getAllRolesCompleteness query', () => {
  it('authenticated user with all roles complete returns allComplete: true', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(true)
  })

  it('authenticated user with one incomplete role returns allComplete: false', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await seedDiveCenterProfile(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
      })
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
        preferredInstructorSlugs: ['test-inst'],
      })
      // Add incomplete Boat role
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        isPrimary: false,
        createdAt: Date.now(),
        profileComplete: false,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getAllRolesCompleteness, {})

    expect(result.allComplete).toBe(false)
    const boatRole = result.roles.find((r: any) => r.role === 'Boat')
    expect(boatRole).toBeDefined()
    expect(boatRole?.incomplete.length).toBeGreaterThan(0)
  })
})
