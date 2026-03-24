import { describe, it, expect, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import {
  seedUser,
  seedDiveCenterProfile,
  seedBookingTemplate,
  seedStakeholderPreferences,
  seedVenue,
  type SeedCtx,
} from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')

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
    const t = convexTest(schema, modules)
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
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedFullProfile(ctx, 'dc-100')
    })

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-100' })
      .query(api.users.getOnboardingStatus, {})

    expect(status.percentage).toBe(100)
    expect(status.incomplete).toHaveLength(0)
  })

  it('createDraftShell rejects with PROFILE_INCOMPLETE at 78%', async () => {
    const t = convexTest(schema, modules)
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
    const t = convexTest(schema, modules)

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

    expect(bookingId).toBeTruthy()
    expect(typeof bookingId).toBe('string')
  })
})
