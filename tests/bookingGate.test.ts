import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  seedUser,
  seedDiveCenterProfile,
  seedAgent,
  seedInstructorProfile,
  seedBoatProfile,
  seedEquipmentProfile,
  seedBookingTemplate,
  seedStakeholderPreferences,
  seedVenue,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Composite helper: complete DC with coverage ─────────────────────────────

async function seedFullDCWithCoverage(ctx: SeedCtx, slug: string) {
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
  // Profile + settings layer
  await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
  await seedDiveCenterProfile(ctx, userId, {
    name: 'Test Dive Center',
    email: 'info@testdc.com',
  })
  // customerLanguages on diveCenters table
  const dc = await ctx.db.query('diveCenters').withIndex('by_userId', (q: any) => q.eq('userId', userId)).unique()
  if (dc) await ctx.db.patch(dc._id, { customerLanguages: ['en'] })

  await seedBookingTemplate(ctx, {
    ownerId: slug,
    ownerType: 'DiveCenter',
    name: 'DSD',
    activityType: ['DSD'],
  })
  await seedStakeholderPreferences(ctx, slug, {
    stakeholderType: 'DiveCenter',
    commonLanguageCodes: [],
    confirmOnAccept: false,
    confirmOnDecline: false,
    preferredInstructorSlugs: ['test-instructor'],
    preferredEquipmentSlugs: ['test-equipment'],
    preferredVenueSlugs: ['test-venue'],
    preferredCompressorSlugs: ['test-compressor'],
  })

  // Coverage resources
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
    confinedCapable: true,
    hasCompressor: false,
    venueType: 'Pool',
  })
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

  return userId
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('booking gate: profile completeness', () => {
  it('createDraftShell rejects when active role incomplete', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'dc-gate-fail',
        tokenIdentifier: 'clerk|dc-gate-fail',
        role: 'DiveCenter',
        email: 'dc-gate-fail@test.com',
        name: 'dc-gate-fail Display',
        firstName: 'dc-gate-fail',
        lastName: 'Test',
        businessName: 'Test Biz',
      })
      // No phone, no appLanguage, no DiveCenter profile -> incomplete
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-gate-fail' })
        .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'DiveCenter' })
    ).rejects.toThrow(/PROFILE_INCOMPLETE/)
  })

  it('createDraftShell succeeds when active role 100% with full coverage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedFullDCWithCoverage(ctx, 'dc-gate-pass')
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|dc-gate-pass' })
      .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'DiveCenter' })
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
        .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'Instructor' }),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})

// ─── Per-active-role gate (not all-roles) ────────────────────────────────────

describe('booking gate: per-active-role completeness', () => {
  it('DC 100% + Boat 0% succeeds when activeRole is DiveCenter', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedFullDCWithCoverage(ctx, 'dc-per-role')
      // Add incomplete Boat role (no profile)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        createdAt: Date.now(),
        profileComplete: false,
      })
    })

    // Should SUCCEED because only DiveCenter (active role) is checked
    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t.withIdentity({ tokenIdentifier: 'clerk|dc-per-role' })
      .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'DiveCenter' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')
    expect((bookingId as string).length).toBeGreaterThan(0)
  })
})
