/**
 * Coverage Gate — Integration Tests
 *
 * Validates that createDraftShell rejects booking creation when the
 * operator's preferred resources don't satisfy all 5 coverage requirements
 * (instructor, equipment, confined water, open water, compressor).
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { testDate } from './helpers/dates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeT() {
  return convexTest(schema, import.meta.glob('../convex/**/*.ts'))
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role = 'DiveCenter') {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedPreferences(
  ctx: Ctx,
  stakeholderId: string,
  stakeholderType: string,
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('stakeholderPreferences', {
    stakeholderId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stakeholderType: stakeholderType as any,
    acceptanceMode: 'Auto',
    maxHoursPerDay: 8,
    postJobBlockDuration: 0,
    useNamedUnits: false,
    commonLanguageCodes: ['en'],
    confirmOnAccept: true,
    confirmOnDecline: true,
    ...overrides,
  })
}

async function seedVenueUser(
  ctx: Ctx,
  slug: string,
  caps: { confinedCapable: boolean; openWaterCapable: boolean; hasCompressor: boolean },
) {
  const userId = await seedUser(ctx, slug, 'Pool')
  await ctx.db.insert('venues', {
    userId,
    name: `${slug} Venue`,
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    focusedLanguages: ['en'],
    verified: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    venueType: 'Pool' as any,
    isPublic: true,
    confinedCapable: caps.confinedCapable,
    openWaterCapable: caps.openWaterCapable,
    hasCompressor: caps.hasCompressor,
  })
}

async function seedBoatUser(ctx: Ctx, slug: string, hasCompressor: boolean) {
  const userId = await seedUser(ctx, slug, 'Boat')
  await ctx.db.insert('boats', {
    userId,
    name: `${slug} Boat`,
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: `${slug}@test.com`,
    contactPhone: '+66123456789',
    fleet: [],
    focusedLanguages: ['en'],
    hasCompressor,
    verified: true,
  })
}

/** Seed diveCenters profile + bookingTemplates so profileCompleteness gate passes */
async function seedDiveCenterProfile(ctx: Ctx, userId: Id<'users'>, slug: string) {
  await ctx.db.insert('diveCenters', {
    userId,
    name: 'Test DC',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: `${slug}@test.com`,
    contactPhone: '+66123456789',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    associations: [{ agency: 'PADI', number: '12345' }] as any,
    focusedLanguages: ['en'],
    verified: true,
  })
  await ctx.db.insert('bookingTemplates', {
    ownerId: slug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownerType: 'DiveCenter' as any,
    name: 'Default',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activityType: ['DSD'] as any,
    createdAt: Date.now(),
  })
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createDraftShell — coverage gate', () => {
  it('rejects with COVERAGE_INCOMPLETE when only instructor is in preferences (no equipment/venue/boat/compressor)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-noprofs')
      await seedDiveCenterProfile(ctx, userId, 'dc-noprofs')
      await seedUser(ctx, 'inst-gate', 'Instructor')
      await seedPreferences(ctx, 'dc-noprofs', 'DiveCenter', {
        preferredInstructorSlugs: ['inst-gate'],
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-noprofs' }).mutation(
        api.bookingDraftMutations.createDraftShell,
        { startDate: testDate(5) },
      ),
      'COVERAGE_INCOMPLETE',
    )
  })

  it('rejects with COVERAGE_INCOMPLETE listing 4 missing when only instructor pref is set', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-empty')
      await seedDiveCenterProfile(ctx, userId, 'dc-empty')
      await seedUser(ctx, 'inst-gate', 'Instructor')
      await seedPreferences(ctx, 'dc-empty', 'DiveCenter', {
        preferredInstructorSlugs: ['inst-gate'],
        preferredEquipmentSlugs: [],
        preferredVenueSlugs: [],
        preferredBoatSlugs: [],
        preferredCompressorSlugs: [],
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-empty' }).mutation(
        api.bookingDraftMutations.createDraftShell,
        { startDate: testDate(5) },
      ),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      const d = data as { code: string; missing: string[] }
      return (
        d.code === 'COVERAGE_INCOMPLETE' &&
        d.missing.length === 4 &&
        !d.missing.includes('instructor') &&
        d.missing.includes('equipmentManager') &&
        d.missing.includes('confinedWater') &&
        d.missing.includes('openWater') &&
        d.missing.includes('compressor')
      )
    })
  })

  it('rejects when only instructor is preferred (missing 4 others)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-partial')
      await seedDiveCenterProfile(ctx, userId, 'dc-partial')
      await seedUser(ctx, 'inst-1', 'Instructor')
      await seedPreferences(ctx, 'dc-partial', 'DiveCenter', {
        preferredInstructorSlugs: ['inst-1'],
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-partial' }).mutation(
        api.bookingDraftMutations.createDraftShell,
        { startDate: testDate(5) },
      ),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      const d = data as { code: string; missing: string[] }
      return (
        d.code === 'COVERAGE_INCOMPLETE' &&
        !d.missing.includes('instructor') &&
        d.missing.includes('equipmentManager')
      )
    })
  })

  it('succeeds when all 5 coverage requirements are met via venue + standalone compressor', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-full')
      await seedDiveCenterProfile(ctx, userId, 'dc-full')
      await seedUser(ctx, 'inst-1', 'Instructor')
      await seedUser(ctx, 'equip-1', 'Equipment')
      await seedUser(ctx, 'comp-1', 'Compressor')
      await seedVenueUser(ctx, 'venue-1', {
        confinedCapable: true,
        openWaterCapable: true,
        hasCompressor: false,
      })
      await seedPreferences(ctx, 'dc-full', 'DiveCenter', {
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['venue-1'],
        preferredCompressorSlugs: ['comp-1'],
      })
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-full' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        startDate: testDate(5),
      })

    expect(bookingId).toBeTruthy()

    // Verify the booking was actually created
    const booking = await t.run(async (ctx) =>
      ctx.db.get(bookingId as Id<'bookings'>),
    )
    expect(booking).not.toBeNull()
    expect(booking!.status).toBe('Draft')
    expect(booking!.ownerId).toBe('dc-full')
  })

  it('succeeds when boat with compressor covers venue + compressor needs', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-boat')
      await seedDiveCenterProfile(ctx, userId, 'dc-boat')
      await seedUser(ctx, 'inst-1', 'Instructor')
      await seedUser(ctx, 'equip-1', 'Equipment')
      await seedBoatUser(ctx, 'boat-1', true)
      await seedPreferences(ctx, 'dc-boat', 'DiveCenter', {
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
      })
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-boat' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        startDate: testDate(5),
      })

    expect(bookingId).toBeTruthy()
  })

  it('succeeds without startDate arg (optional dates)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-nodate')
      await seedDiveCenterProfile(ctx, userId, 'dc-nodate')
      await seedUser(ctx, 'inst-1', 'Instructor')
      await seedUser(ctx, 'equip-1', 'Equipment')
      await seedUser(ctx, 'comp-1', 'Compressor')
      await seedVenueUser(ctx, 'venue-1', {
        confinedCapable: true,
        openWaterCapable: true,
        hasCompressor: false,
      })
      await seedPreferences(ctx, 'dc-nodate', 'DiveCenter', {
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['venue-1'],
        preferredCompressorSlugs: ['comp-1'],
      })
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-nodate' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})

    expect(bookingId).toBeTruthy()
  })
})
