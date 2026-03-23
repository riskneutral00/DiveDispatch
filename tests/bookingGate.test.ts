import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(
  ctx: Ctx,
  slug: string,
  role: string = 'DiveCenter',
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
    ...overrides,
  })
}

async function seedDiveCenterProfile(
  ctx: Ctx,
  userId: any,
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('diveCenters', {
    userId,
    name: 'Test Dive Center',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: 'info@testdc.com',
    contactPhone: '+66123456789',
    associations: [{ agency: 'PADI', number: '12345' }],
    focusedLanguages: ['en'],
    verified: false,
    ...overrides,
  } as any)
}

async function seedFullProfile(ctx: Ctx, slug: string) {
  // Create user
  const userId = await seedUser(ctx, slug)
  // Create DC profile with all fields
  await seedDiveCenterProfile(ctx, userId)
  // Create booking template (Quick Book pill)
  await ctx.db.insert('bookingTemplates', {
    ownerId: slug,
    ownerType: 'DiveCenter',
    name: 'DSD',
    activityType: ['DSD'],
    createdAt: Date.now(),
  } as any)
  // Create stakeholder preferences with preferred instructors
  await ctx.db.insert('stakeholderPreferences', {
    stakeholderId: slug,
    stakeholderType: 'DiveCenter',
    acceptanceMode: 'Auto',
    maxHoursPerDay: 0,
    postJobBlockDuration: 0,
    useNamedUnits: false,
    commonLanguageCodes: [],
    confirmOnAccept: false,
    confirmOnDecline: false,
    preferredInstructorSlugs: ['test-instructor-1', 'test-instructor-2'],
  } as any)
  return userId
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('booking gate: profile completeness', () => {
  it('getOnboardingStatus returns 78% when missing template + preferred instructors', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-78')
      await seedDiveCenterProfile(ctx, userId)
      // Seed preferences WITHOUT preferredInstructorSlugs
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'dc-78',
        stakeholderType: 'DiveCenter',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
      } as any)
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
      const userId = await seedUser(ctx, 'dc-gate-fail')
      await seedDiveCenterProfile(ctx, userId)
      // Preferences without preferred instructors
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'dc-gate-fail',
        stakeholderType: 'DiveCenter',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 0,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: [],
        confirmOnAccept: false,
        confirmOnDecline: false,
      } as any)
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
        } as any)
      }

      // Create instructor user
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|test-instructor',
        slug: 'test-instructor',
        email: 'inst@test.com',
        name: 'Test Instructor',
        firstName: 'Test',
        lastName: 'Instructor',
        businessName: 'Test Instructor',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      } as any)

      // Create equipment user
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|test-equipment',
        slug: 'test-equipment',
        email: 'eq@test.com',
        name: 'Test Equipment',
        firstName: 'Test',
        lastName: 'Equipment',
        businessName: 'Test Equipment',
        role: 'Equipment',
        isSeeded: false,
        preferredLocale: 'en',
      } as any)

      // Create venue user + venue record (confined + open water capable)
      const venueUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|test-venue',
        slug: 'test-venue',
        email: 'venue@test.com',
        name: 'Test Venue',
        firstName: 'Test',
        lastName: 'Venue',
        businessName: 'Test Venue',
        role: 'Pool',
        isSeeded: false,
        preferredLocale: 'en',
      } as any)

      await ctx.db.insert('venues', {
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
      } as any)

      // Create compressor user
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|test-compressor',
        slug: 'test-compressor',
        email: 'comp@test.com',
        name: 'Test Compressor',
        firstName: 'Test',
        lastName: 'Compressor',
        businessName: 'Test Compressor',
        role: 'Compressor',
        isSeeded: false,
        preferredLocale: 'en',
      } as any)
    })

    // This should succeed — passes both profile gate (100%) and coverage gate
    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|dc-gate-pass' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})

    expect(bookingId).toBeTruthy()
    expect(typeof bookingId).toBe('string')
  })
})
