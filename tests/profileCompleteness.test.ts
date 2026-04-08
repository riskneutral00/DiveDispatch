import { describe, it, expect, beforeEach } from 'vitest'
import { checkProfileCompleteness, checkAllRolesCompleteness } from '../convex/lib/profileCompleteness'
import { api } from '../convex/_generated/api'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedDiveCenterProfile,
  seedInstructorProfile,
  seedEquipmentProfile,
  seedAgent,
  seedBoatProfile,
  seedStakeholderPreferences,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── checkProfileCompleteness per-role accuracy ──────────────────────────────

describe('checkProfileCompleteness', () => {
  it('Equipment with all fields and user profile/settings complete returns 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        role: 'Equipment',
      })
      // Set profile-layer and settings-layer fields
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedEquipmentProfile(ctx, userId)

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Equipment')

      expect(result.percentage).toBe(100)
      expect(result.incomplete).toHaveLength(0)
    })
  })

  it('missing firstName on users table makes profile incomplete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        role: 'Equipment',
        firstName: '',
      })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedEquipmentProfile(ctx, userId)

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Equipment')

      expect(result.incomplete).toContain('firstName')
      expect(result.percentage).toBeLessThan(100)
    })
  })

  it('missing phone on users table makes profile incomplete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.patch(userId, { appLanguage: 'en', phone: '' })
      await seedEquipmentProfile(ctx, userId)

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Equipment')

      expect(result.incomplete).toContain('phone')
    })
  })

  it('missing appLanguage on users table makes settings layer incomplete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        role: 'Equipment',
      })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: '' })
      await seedEquipmentProfile(ctx, userId)

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Equipment')

      expect(result.incomplete).toContain('appLanguage')
    })
  })

  it('missing role-specific field (credential) makes role layer incomplete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      // Instructor with empty credential array
      await seedInstructorProfile(ctx, userId, { credential: [] })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')

      expect(result.incomplete).toContain('credential')
      expect(result.percentage).toBeLessThan(100)
    })
  })

  it('percentage correct across all three layers', async () => {
    await t.run(async (ctx) => {
      // Equipment role required: name, placeName (2 role fields)
      // Profile required: firstName, lastName, email, phone (4)
      // Settings required: appLanguage (1)
      // Total: 7
      // Missing: appLanguage + phone = 2 missing -> 5/7 filled = 71%
      const userId = await seedUser(ctx, {
        role: 'Equipment',
      })
      await ctx.db.patch(userId, { appLanguage: '', phone: '' })
      await seedEquipmentProfile(ctx, userId)

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Equipment')

      expect(result.percentage).toBe(71)
      expect(result.incomplete).toHaveLength(2)
      expect(result.incomplete).toContain('appLanguage')
      expect(result.incomplete).toContain('phone')
    })
  })

  it('Agent with profile but no users.customerLanguages marks customerLanguages incomplete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Agent' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedAgent(ctx, userId)

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Agent')

      expect(result.incomplete).toContain('customerLanguages')
      expect(result.percentage).toBeLessThan(100)
    })
  })

  it('DiveCenter with no profile record marks role fields incomplete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      // No dive center profile seeded

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'DiveCenter')

      // Role fields: name, placeName, country, associations, customerLanguages = 5 missing
      expect(result.incomplete).toContain('name')
      expect(result.incomplete).toContain('placeName')
      expect(result.incomplete).toContain('country')
      expect(result.incomplete).toContain('associations')
      expect(result.incomplete).toContain('customerLanguages')
    })
  })

  it('DiveCenter missing operator prefs and coverage fields stays below 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'DiveCenter', slug: 'dc-operator-gaps', tokenIdentifier: 'clerk|dc-operator-gaps' })
      await ctx.db.patch(userId, { phone: '+66000000004', appLanguage: 'en' })
      await seedDiveCenterProfile(ctx, userId)

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'DiveCenter')

      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toEqual(expect.arrayContaining([
        'acceptanceMode',
        'preferredInstructor',
        'preferredEquipment',
        'preferredVenueOrBoat',
        'preferredCompressor',
      ]))
    })
  })
})

// ─── DiveCenter operator — compressor coverage layer ─────────────────────────

describe('checkProfileCompleteness — DiveCenter compressor coverage', () => {
  it('returns 100% when a preferred boat with hasCompressor=true satisfies compressor requirement', async () => {
    await t.run(async (ctx) => {
      const dcId = await seedUser(ctx, { role: 'DiveCenter', slug: 'dc-boatcomp', tokenIdentifier: 'clerk|dc-boatcomp' })
      await ctx.db.patch(dcId, { phone: '+66000000001' })
      await seedDiveCenterProfile(ctx, dcId)

      const boatId = await seedUser(ctx, { role: 'Boat', slug: 'boat-hascomp', tokenIdentifier: 'clerk|boat-hascomp' })
      const boatProfileId = await seedBoatProfile(ctx, boatId)
      await ctx.db.patch(boatProfileId, { hasCompressor: true })

      await seedStakeholderPreferences(ctx, 'dc-boatcomp', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['any-instr'],
        preferredEquipmentSlugs: ['any-equip'],
        preferredBoatSlugs: ['boat-hascomp'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: dcId }, 'DiveCenter')
      expect(result.percentage).toBe(100)
      expect(result.incomplete).toHaveLength(0)
    })
  })

  it('returns 100% when preferredCompressorSlugs is populated directly', async () => {
    await t.run(async (ctx) => {
      const dcId = await seedUser(ctx, { role: 'DiveCenter', slug: 'dc-directcomp', tokenIdentifier: 'clerk|dc-directcomp' })
      await ctx.db.patch(dcId, { phone: '+66000000002' })
      await seedDiveCenterProfile(ctx, dcId)

      await seedStakeholderPreferences(ctx, 'dc-directcomp', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['any-instr'],
        preferredEquipmentSlugs: ['any-equip'],
        preferredVenueSlugs: ['any-venue'],
        preferredCompressorSlugs: ['any-compressor'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: dcId }, 'DiveCenter')
      expect(result.percentage).toBe(100)
      expect(result.incomplete).toHaveLength(0)
    })
  })

  it('marks preferredCompressor incomplete when preferred boat has hasCompressor=false and no compressor slug', async () => {
    await t.run(async (ctx) => {
      const dcId = await seedUser(ctx, { role: 'DiveCenter', slug: 'dc-nocomp', tokenIdentifier: 'clerk|dc-nocomp' })
      await ctx.db.patch(dcId, { phone: '+66000000003' })
      await seedDiveCenterProfile(ctx, dcId)

      const boatId = await seedUser(ctx, { role: 'Boat', slug: 'boat-nocomp', tokenIdentifier: 'clerk|boat-nocomp' })
      await seedBoatProfile(ctx, boatId, { hasCompressor: false })

      await seedStakeholderPreferences(ctx, 'dc-nocomp', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['any-instr'],
        preferredEquipmentSlugs: ['any-equip'],
        preferredBoatSlugs: ['boat-nocomp'],
        // no preferredCompressorSlugs
      })

      const result = await checkProfileCompleteness(ctx, { _id: dcId }, 'DiveCenter')
      expect(result.incomplete).toContain('preferredCompressor')
      expect(result.percentage).toBeLessThan(100)
    })
  })
})

// ─── checkAllRolesCompleteness ───────────────────────────────────────────────

describe('checkAllRolesCompleteness', () => {
  it('single role at 100% returns allComplete: true', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Equipment' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedEquipmentProfile(ctx, userId)

      const result = await checkAllRolesCompleteness(ctx, userId)

      expect(result.allComplete).toBe(true)
      expect(result.roles).toHaveLength(1)
      expect(result.roles[0].percentage).toBe(100)
    })
  })

  it('multi-role with one incomplete returns allComplete: false', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Equipment' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedEquipmentProfile(ctx, userId)
      // Add incomplete Instructor role (no profile)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
        profileComplete: false,
      })

      const result = await checkAllRolesCompleteness(ctx, userId)

      expect(result.allComplete).toBe(false)
      expect(result.roles).toHaveLength(2)
      const equipmentRole = result.roles.find(r => r.role === 'Equipment')
      const instructorRole = result.roles.find(r => r.role === 'Instructor')
      expect(equipmentRole?.percentage).toBe(100)
      expect(instructorRole?.percentage).toBeLessThan(100)
    })
  })
})

// ─── getProfileCompletionForRole query ────────────────────────────────────────

describe('getProfileCompletionForRole query', () => {
  it('returns completeness for specified role', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Equipment' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedEquipmentProfile(ctx, userId)
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getProfileCompletionForRole, { role: 'Equipment' })

    expect(result.percentage).toBe(100)
    expect(result.incomplete).toHaveLength(0)
  })

  it('returns incomplete fields when role profile missing', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx)
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      // No DiveCenter profile seeded
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getProfileCompletionForRole, { role: 'DiveCenter' })

    expect(result.percentage).toBeLessThan(100)
    expect(result.incomplete).toContain('name')
  })
})
