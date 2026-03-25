import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  seedUser,
  seedDiveCenterProfile,
  seedAgent,
  seedInstructorProfile,
  seedBoatProfile,
  seedBookingTemplate,
  seedStakeholderPreferences,
  seedVenue,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Composite helper ────────────────────────────────────────────────────────

async function seedFullProfile(ctx: SeedCtx, slug: string) {
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
    name: 'Test Dive Center',
    contactEmail: 'info@testdc.com',
  })
  await seedBookingTemplate(ctx, {
    ownerId: slug,
    ownerType: 'DiveCenter',
    name: 'DSD',
    activityType: ['DSD'],
  })
  await seedStakeholderPreferences(ctx, slug, {
    stakeholderType: 'DiveCenter',
    maxHoursPerDay: 0,
    postJobBlockDuration: 0,
    commonLanguageCodes: [],
    confirmOnAccept: false,
    confirmOnDecline: false,
    preferredInstructorSlugs: ['test-instructor-1', 'test-instructor-2'],
  })
  return userId
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('booking gate: profile completeness', () => {
  it('getOnboardingStatus returns 78% when missing template + preferred instructors', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        slug: 'dc-78',
        tokenIdentifier: 'clerk|dc-78',
        role: 'DiveCenter',
        email: 'dc-78@test.com',
        name: 'dc-78 Display',
        firstName: 'dc-78',
        lastName: 'Test',
        businessName: 'Test Biz',
      })
      await seedDiveCenterProfile(ctx, userId, {
        name: 'Test Dive Center',
        contactEmail: 'info@testdc.com',
      })
      // Seed preferences WITHOUT preferredInstructorSlugs
      await seedStakeholderPreferences(ctx, 'dc-78', {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
      })
    })

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-78' })
      .query(api.users.getOnboardingStatus, {})

    expect(status.percentage).toBe(78)
    expect(status.incomplete).toContain('Quick Book pill')
    expect(status.incomplete).toContain('Preferred instructors')
  })

  it('getOnboardingStatus returns 100% with all fields complete', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedFullProfile(ctx, 'dc-100')
    })

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-100' })
      .query(api.users.getOnboardingStatus, {})

    expect(status.percentage).toBe(100)
    expect(status.incomplete).toHaveLength(0)
  })

  it('createDraftShell rejects with PROFILE_INCOMPLETE at 78%', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        slug: 'dc-gate-fail',
        tokenIdentifier: 'clerk|dc-gate-fail',
        role: 'DiveCenter',
        email: 'dc-gate-fail@test.com',
        name: 'dc-gate-fail Display',
        firstName: 'dc-gate-fail',
        lastName: 'Test',
        businessName: 'Test Biz',
      })
      await seedDiveCenterProfile(ctx, userId, {
        name: 'Test Dive Center',
        contactEmail: 'info@testdc.com',
      })
      // Preferences without preferred instructors
      await seedStakeholderPreferences(ctx, 'dc-gate-fail', {
        stakeholderType: 'DiveCenter',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-gate-fail' })
        .mutation(api.bookingDraftMutations.createDraftShell, {})
    ).rejects.toThrow(/PROFILE_INCOMPLETE/)
  })

  it('createDraftShell succeeds at 100% with full coverage', async () => {
    const t = makeT()

    // Seed a full profile + coverage resources
    await t.run(async (ctx) => {
      await seedFullProfile(ctx, 'dc-gate-pass')

      // Update the preferences to include all coverage fields
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', 'dc-gate-pass'))
        .unique()
      if (prefs) {
        await ctx.db.patch(prefs._id, {
          preferredInstructorSlugs: ['test-instructor'],
          preferredEquipmentSlugs: ['test-equipment'],
          preferredVenueSlugs: ['test-venue'],
          preferredCompressorSlugs: ['test-compressor'],
        })
      }

      // Create instructor user
      await seedUser(ctx, {
        slug: 'test-instructor',
        tokenIdentifier: 'clerk|test-instructor',
        role: 'Instructor',
        email: 'inst@test.com',
        name: 'Test Instructor',
        firstName: 'Test',
        lastName: 'Instructor',
        businessName: 'Test Instructor',
      })

      // Create equipment user
      await seedUser(ctx, {
        slug: 'test-equipment',
        tokenIdentifier: 'clerk|test-equipment',
        role: 'Equipment',
        email: 'eq@test.com',
        name: 'Test Equipment',
        firstName: 'Test',
        lastName: 'Equipment',
        businessName: 'Test Equipment',
      })

      // Create venue user + venue record (confined + open water capable)
      const venueUserId = await seedUser(ctx, {
        slug: 'test-venue',
        tokenIdentifier: 'clerk|test-venue',
        role: 'Pool',
        email: 'venue@test.com',
        name: 'Test Venue',
        firstName: 'Test',
        lastName: 'Venue',
        businessName: 'Test Venue',
      })

      await seedVenue(ctx, {
        userId: venueUserId,
        name: 'Test Pool',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10.0,
        lng: 99.8,
        focusedLanguages: ['en'],
        verified: false,
        confinedCapable: true,
        openWaterCapable: true,
        hasCompressor: false,
        isPublic: false,
        venueType: 'Pool',
      })

      // Create compressor user
      await seedUser(ctx, {
        slug: 'test-compressor',
        tokenIdentifier: 'clerk|test-compressor',
        role: 'Compressor',
        email: 'comp@test.com',
        name: 'Test Compressor',
        firstName: 'Test',
        lastName: 'Compressor',
        businessName: 'Test Compressor',
      })
    })

    // This should succeed — passes both profile gate (100%) and coverage gate
    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|dc-gate-pass' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')
    expect((bookingId as string).length).toBeGreaterThan(0)
  })
})

// ─── Role enforcement ────────────────────────────────────────────────────────

describe('booking gate: role enforcement', () => {
  it('resource role (Instructor) is rejected with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'inst-gate',
        tokenIdentifier: 'clerk|inst-gate',
        role: 'Instructor',
        email: 'inst-gate@test.com',
        name: 'Instructor Gate',
        firstName: 'Inst',
        lastName: 'Gate',
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|inst-gate' })
        .mutation(api.bookingDraftMutations.createDraftShell, {}),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('resource role (Boat) is rejected with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'boat-gate',
        tokenIdentifier: 'clerk|boat-gate',
        role: 'Boat',
        email: 'boat-gate@test.com',
        name: 'Boat Gate',
        firstName: 'Boat',
        lastName: 'Gate',
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|boat-gate' })
        .mutation(api.bookingDraftMutations.createDraftShell, {}),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})

// ─── Non-DiveCenter operator ─────────────────────────────────────────────────

async function seedFullAgentProfile(ctx: SeedCtx, slug: string) {
  const userId = await seedUser(ctx, {
    slug,
    tokenIdentifier: `clerk|${slug}`,
    role: 'Agent',
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Agent Biz',
  })
  await seedAgent(ctx, userId, {
    name: 'Test Agent',
    contactEmail: 'agent@test.com',
    contactPhone: '+66987654321',
    associations: [{ agency: 'PADI', number: '99999' }],
    focusedLanguages: ['en'],
  })
  await seedBookingTemplate(ctx, {
    ownerId: slug,
    ownerType: 'Agent',
    name: 'DSD',
    activityType: ['DSD'],
  })
  await seedStakeholderPreferences(ctx, slug, {
    stakeholderType: 'Agent',
    maxHoursPerDay: 0,
    postJobBlockDuration: 0,
    commonLanguageCodes: [],
    confirmOnAccept: false,
    confirmOnDecline: false,
    preferredInstructorSlugs: ['test-instructor-1'],
  })
  return userId
}

describe('booking gate: non-DiveCenter operator', () => {
  it('Agent with incomplete profile is rejected with PROFILE_INCOMPLETE', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'agent-incomplete',
        tokenIdentifier: 'clerk|agent-incomplete',
        role: 'Agent',
        email: 'agent-incomplete@test.com',
        name: 'Agent Incomplete',
        firstName: 'Agent',
        lastName: 'Incomplete',
        businessName: 'Incomplete Agency',
      })
      // Agent profile exists but no template + no preferred instructors
      await seedAgent(ctx, await ctx.db.query('users').withIndex('by_slug', (q: any) => q.eq('slug', 'agent-incomplete')).unique().then((u: any) => u!._id), {
        name: 'Incomplete Agency',
        contactEmail: 'agent@test.com',
        contactPhone: '+66111111111',
        associations: [{ agency: 'PADI', number: '11111' }],
        focusedLanguages: ['en'],
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-incomplete' })
        .mutation(api.bookingDraftMutations.createDraftShell, {}),
    ).rejects.toThrow(/PROFILE_INCOMPLETE/)
  })

  it('Agent with 100% profile succeeds', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedFullAgentProfile(ctx, 'agent-complete')

      // Coverage resources
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', 'agent-complete'))
        .unique()
      if (prefs) {
        await ctx.db.patch(prefs._id, {
          preferredInstructorSlugs: ['test-inst-a'],
          preferredEquipmentSlugs: ['test-equip-a'],
          preferredVenueSlugs: ['test-venue-a'],
          preferredCompressorSlugs: ['test-comp-a'],
        })
      }

      await seedUser(ctx, {
        slug: 'test-inst-a',
        tokenIdentifier: 'clerk|test-inst-a',
        role: 'Instructor',
        email: 'inst-a@test.com',
        name: 'Inst A',
        firstName: 'Inst',
        lastName: 'A',
      })
      await seedUser(ctx, {
        slug: 'test-equip-a',
        tokenIdentifier: 'clerk|test-equip-a',
        role: 'Equipment',
        email: 'equip-a@test.com',
        name: 'Equip A',
        firstName: 'Equip',
        lastName: 'A',
      })
      const venueUserId = await seedUser(ctx, {
        slug: 'test-venue-a',
        tokenIdentifier: 'clerk|test-venue-a',
        role: 'Pool',
        email: 'venue-a@test.com',
        name: 'Venue A',
        firstName: 'Venue',
        lastName: 'A',
      })
      await seedVenue(ctx, {
        userId: venueUserId,
        name: 'Agent Test Pool',
        confinedCapable: true,
        openWaterCapable: true,
        hasCompressor: false,
        isPublic: false,
        venueType: 'Pool',
      })
      await seedUser(ctx, {
        slug: 'test-comp-a',
        tokenIdentifier: 'clerk|test-comp-a',
        role: 'Compressor',
        email: 'comp-a@test.com',
        name: 'Comp A',
        firstName: 'Comp',
        lastName: 'A',
      })
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|agent-complete' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')
    expect((bookingId as string).length).toBeGreaterThan(0)
  })
})

// ─── Multi-role profile completeness gate ────────────────────────────────────

describe('booking gate: multi-role profile completeness', () => {
  it('DC 100% + Boat 0% is rejected with PROFILE_INCOMPLETE', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedFullProfile(ctx, 'dc-multi-fail')
      // Add Boat role with no profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        isPrimary: false,
        createdAt: Date.now(),
        profileComplete: false,
      })

      // Coverage resources
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', 'dc-multi-fail'))
        .unique()
      if (prefs) {
        await ctx.db.patch(prefs._id, {
          preferredInstructorSlugs: ['test-inst-m'],
          preferredEquipmentSlugs: ['test-equip-m'],
          preferredVenueSlugs: ['test-venue-m'],
          preferredCompressorSlugs: ['test-comp-m'],
        })
      }
      await seedUser(ctx, { slug: 'test-inst-m', tokenIdentifier: 'clerk|test-inst-m', role: 'Instructor', email: 'im@test.com', name: 'IM', firstName: 'I', lastName: 'M' })
      await seedUser(ctx, { slug: 'test-equip-m', tokenIdentifier: 'clerk|test-equip-m', role: 'Equipment', email: 'em@test.com', name: 'EM', firstName: 'E', lastName: 'M' })
      const venueUserId = await seedUser(ctx, { slug: 'test-venue-m', tokenIdentifier: 'clerk|test-venue-m', role: 'Pool', email: 'vm@test.com', name: 'VM', firstName: 'V', lastName: 'M' })
      await seedVenue(ctx, { userId: venueUserId, name: 'Multi Pool', confinedCapable: true, openWaterCapable: true, hasCompressor: false, isPublic: false, venueType: 'Pool' })
      await seedUser(ctx, { slug: 'test-comp-m', tokenIdentifier: 'clerk|test-comp-m', role: 'Compressor', email: 'cm@test.com', name: 'CM', firstName: 'C', lastName: 'M' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-multi-fail' })
        .mutation(api.bookingDraftMutations.createDraftShell, {}),
    ).rejects.toThrow(/PROFILE_INCOMPLETE/)
  })

  it('DC 100% + Instructor 100% passes the profile gate', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedFullProfile(ctx, 'dc-multi-pass')
      // Add Instructor role with complete profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        isPrimary: false,
        createdAt: Date.now(),
        profileComplete: false,
      })
      await seedInstructorProfile(ctx, userId)

      // Coverage resources
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', 'dc-multi-pass'))
        .unique()
      if (prefs) {
        await ctx.db.patch(prefs._id, {
          preferredInstructorSlugs: ['test-inst-p'],
          preferredEquipmentSlugs: ['test-equip-p'],
          preferredVenueSlugs: ['test-venue-p'],
          preferredCompressorSlugs: ['test-comp-p'],
        })
      }
      await seedUser(ctx, { slug: 'test-inst-p', tokenIdentifier: 'clerk|test-inst-p', role: 'Instructor', email: 'ip@test.com', name: 'IP', firstName: 'I', lastName: 'P' })
      await seedUser(ctx, { slug: 'test-equip-p', tokenIdentifier: 'clerk|test-equip-p', role: 'Equipment', email: 'ep@test.com', name: 'EP', firstName: 'E', lastName: 'P' })
      const venueUserId = await seedUser(ctx, { slug: 'test-venue-p', tokenIdentifier: 'clerk|test-venue-p', role: 'Pool', email: 'vp@test.com', name: 'VP', firstName: 'V', lastName: 'P' })
      await seedVenue(ctx, { userId: venueUserId, name: 'Pass Pool', confinedCapable: true, openWaterCapable: true, hasCompressor: false, isPublic: false, venueType: 'Pool' })
      await seedUser(ctx, { slug: 'test-comp-p', tokenIdentifier: 'clerk|test-comp-p', role: 'Compressor', email: 'cp@test.com', name: 'CP', firstName: 'C', lastName: 'P' })
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|dc-multi-pass' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')
    expect((bookingId as string).length).toBeGreaterThan(0)
  })
})
