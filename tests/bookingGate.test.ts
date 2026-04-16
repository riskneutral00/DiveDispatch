import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { ErrorCode } from '../convex/lib/errorCodes'
import { assertRoleReadiness } from '../convex/userRoles'
import {
  seedUser,
  seedDiveCenterProfile,
  seedAgent,
  seedInstructorProfile,
  seedDiveMasterProfile,
  seedBoatProfile,
  seedEquipmentProfile,
  seedBooking,
  seedBookingTemplate,
  seedStakeholderPreferences,
  seedVenue,
  type SeedCtx,
} from './fixtures'
import { testDate } from './helpers/dates'
import { makeT, expectConvexError } from './helpers/convex-helpers'

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
    hasCompressor: false,
    venueCategory: 'pool',
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

describe('booking gate: shared readiness boundary', () => {
  it('blocks 99% completeness', () => {
    expect(() => assertRoleReadiness({ percentage: 99, incomplete: ['phone'] })).toThrow(/PROFILE_INCOMPLETE/)
  })

  it('allows 100% completeness', () => {
    expect(() => assertRoleReadiness({ percentage: 100, incomplete: [] })).not.toThrow()
  })
})

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

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-gate-fail' })
        .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'DiveCenter' }),
      ErrorCode.PROFILE_INCOMPLETE,
    )
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

  it('DC 100% + Agent 0% rejects when activeRole is Agent', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedFullDCWithCoverage(ctx, 'agent-per-role-fail')
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Agent',
        createdAt: Date.now(),
        profileComplete: false,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|agent-per-role-fail' })
        .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'Agent' }),
      ErrorCode.PROFILE_INCOMPLETE,
    )
  })
})

// ─── Capability gate: DiveMaster rank enforcement ───────────────────────────

const startDate = testDate(5)
const endDate = testDate(7)

function makeDiver(activityType: string[]) {
  return {
    name: 'Alice',
    abbrev: 'AL',
    flag: { code: 'en', label: 'English' },
    startDate,
    endDate,
    activityType,
  }
}

describe('booking gate: capability gate blocks DM from OW+', () => {
  it('DiveMaster assigned to OW booking throws CAPABILITY_GAP', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'dc-cap',
        tokenIdentifier: 'clerk|dc-cap',
        role: 'DiveCenter',
        email: 'dc-cap@test.com',
        name: 'DC Cap',
        firstName: 'DC',
        lastName: 'Cap',
        businessName: 'Cap DC',
      })
      const instUserId = await seedUser(ctx, {
        slug: 'inst-cap',
        tokenIdentifier: 'clerk|inst-cap',
        role: 'Instructor',
        email: 'inst-cap@test.com',
        name: 'Inst Cap',
        firstName: 'Inst',
        lastName: 'Cap',
      })
      await seedInstructorProfile(ctx, instUserId)

      const dmUserId = await seedUser(ctx, {
        slug: 'dm-cap',
        tokenIdentifier: 'clerk|dm-cap',
        role: 'DiveMaster',
        email: 'dm-cap@test.com',
        name: 'DM Cap',
        firstName: 'DM',
        lastName: 'Cap',
      })
      await seedDiveMasterProfile(ctx, dmUserId)

      return seedBooking(ctx, {
        ownerId: 'dc-cap',
        activityType: ['OW'],
        bookingFormComplete: false,
        divers: [],
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-cap' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [],
          bookingData: {
            activityType: ['OW'],
            startDate,
            endDate,
            portalContact: false,
            portalMedical: false,
            portalWaiver: false,
            resources: [
              { resourceType: 'Instructor', resourceId: 'inst-cap', roleType: 'Instructor' },
              { resourceType: 'Instructor', resourceId: 'dm-cap', roleType: 'DiveMaster' },
            ],
            divers: [makeDiver(['OW'])],
          },
        },
      ),
      ErrorCode.CAPABILITY_GAP,
    )
  })

  it('DiveMaster assigned to DSD booking passes gate (trojan horse)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'dc-cap2',
        tokenIdentifier: 'clerk|dc-cap2',
        role: 'DiveCenter',
        email: 'dc-cap2@test.com',
        name: 'DC Cap2',
        firstName: 'DC',
        lastName: 'Cap2',
        businessName: 'Cap DC2',
      })
      const instUserId = await seedUser(ctx, {
        slug: 'inst-cap2',
        tokenIdentifier: 'clerk|inst-cap2',
        role: 'Instructor',
        email: 'inst-cap2@test.com',
        name: 'Inst Cap2',
        firstName: 'Inst',
        lastName: 'Cap2',
      })
      await seedInstructorProfile(ctx, instUserId)

      const dmUserId = await seedUser(ctx, {
        slug: 'dm-cap2',
        tokenIdentifier: 'clerk|dm-cap2',
        role: 'DiveMaster',
        email: 'dm-cap2@test.com',
        name: 'DM Cap2',
        firstName: 'DM',
        lastName: 'Cap2',
      })
      await seedDiveMasterProfile(ctx, dmUserId)

      return seedBooking(ctx, {
        ownerId: 'dc-cap2',
        activityType: ['DSD'],
        bookingFormComplete: false,
        divers: [],
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-cap2' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [],
          bookingData: {
            activityType: ['DSD'],
            startDate,
            endDate,
            portalContact: false,
            portalMedical: false,
            portalWaiver: false,
            resources: [
              { resourceType: 'Instructor', resourceId: 'inst-cap2', roleType: 'Instructor' },
              { resourceType: 'Instructor', resourceId: 'dm-cap2', roleType: 'DiveMaster' },
            ],
            divers: [makeDiver(['DSD'])],
          },
        },
      ),
    ).resolves.toBeDefined()
  })
})
