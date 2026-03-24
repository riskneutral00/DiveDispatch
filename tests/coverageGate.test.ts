/**
 * Coverage Gate — Integration Tests
 *
 * Validates that createDraftShell rejects booking creation when the
 * operator's preferred resources don't satisfy all 5 coverage requirements
 * (instructor, equipment, confined water, open water, compressor).
 */

import { convexTest } from 'convex-test'
import { describe, it, expect, vi } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { testDate } from './helpers/dates'
import {
  seedUser,
  seedStakeholderPreferences,
  seedDiveCenterProfile,
  seedBookingTemplate,
  seedVenue,
  type SeedCtx,
} from './fixtures/seedFixture'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeT() {
  return convexTest(schema, import.meta.glob('../convex/**/*.ts'))
}

/** Thin wrapper: adapts positional (ctx, slug, role?) to shared seedUser overrides format */
async function seedUserBySlug(ctx: SeedCtx, slug: string, role: Parameters<typeof seedUser>[1]['role'] = 'DiveCenter') {
  return seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: `${slug} Display`, firstName: slug, lastName: 'Test', role })
}

async function seedVenueUser(
  ctx: SeedCtx,
  slug: string,
  caps: { confinedCapable: boolean; openWaterCapable: boolean; hasCompressor: boolean },
) {
  const userId = await seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: `${slug} Display`, firstName: slug, lastName: 'Test', role: 'Pool' })
  await seedVenue(ctx, {
    userId,
    name: `${slug} Venue`,
    confinedCapable: caps.confinedCapable,
    openWaterCapable: caps.openWaterCapable,
    hasCompressor: caps.hasCompressor,
  })
}

async function seedBoatUser(ctx: SeedCtx, slug: string, hasCompressor: boolean) {
  const userId = await seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: `${slug} Display`, firstName: slug, lastName: 'Test', role: 'Boat' })
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
async function seedDCProfile(ctx: SeedCtx, userId: Id<'users'>, slug: string) {
  await seedDiveCenterProfile(ctx, userId, { contactEmail: `${slug}@test.com` })
  await seedBookingTemplate(ctx, { ownerId: slug, activityType: ['DSD'] })
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
      const userId = await seedUserBySlug(ctx, 'dc-noprofs')
      await seedDCProfile(ctx, userId,'dc-noprofs')
      await seedUserBySlug(ctx, 'inst-gate', 'Instructor')
      await seedStakeholderPreferences(ctx, 'dc-noprofs', {
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
      const userId = await seedUserBySlug(ctx, 'dc-empty')
      await seedDCProfile(ctx, userId,'dc-empty')
      await seedUserBySlug(ctx, 'inst-gate', 'Instructor')
      await seedStakeholderPreferences(ctx, 'dc-empty', {
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
      const userId = await seedUserBySlug(ctx, 'dc-partial')
      await seedDCProfile(ctx, userId,'dc-partial')
      await seedUserBySlug(ctx, 'inst-1', 'Instructor')
      await seedStakeholderPreferences(ctx, 'dc-partial', {
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
      const userId = await seedUserBySlug(ctx, 'dc-full')
      await seedDCProfile(ctx, userId,'dc-full')
      await seedUserBySlug(ctx, 'inst-1', 'Instructor')
      await seedUserBySlug(ctx, 'equip-1', 'Equipment')
      await seedUserBySlug(ctx, 'comp-1', 'Compressor')
      await seedVenueUser(ctx, 'venue-1', {
        confinedCapable: true,
        openWaterCapable: true,
        hasCompressor: false,
      })
      await seedStakeholderPreferences(ctx, 'dc-full', {
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['venue-1'],
        preferredCompressorSlugs: ['comp-1'],
      })
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-full' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        startDate: testDate(5),
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

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
      const userId = await seedUserBySlug(ctx, 'dc-boat')
      await seedDCProfile(ctx, userId,'dc-boat')
      await seedUserBySlug(ctx, 'inst-1', 'Instructor')
      await seedUserBySlug(ctx, 'equip-1', 'Equipment')
      await seedBoatUser(ctx, 'boat-1', true)
      await seedStakeholderPreferences(ctx, 'dc-boat', {
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
      })
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-boat' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        startDate: testDate(5),
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(bookingId).toBeTruthy()
  })

  it('succeeds without startDate arg (optional dates)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserBySlug(ctx, 'dc-nodate')
      await seedDCProfile(ctx, userId,'dc-nodate')
      await seedUserBySlug(ctx, 'inst-1', 'Instructor')
      await seedUserBySlug(ctx, 'equip-1', 'Equipment')
      await seedUserBySlug(ctx, 'comp-1', 'Compressor')
      await seedVenueUser(ctx, 'venue-1', {
        confinedCapable: true,
        openWaterCapable: true,
        hasCompressor: false,
      })
      await seedStakeholderPreferences(ctx, 'dc-nodate', {
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['venue-1'],
        preferredCompressorSlugs: ['comp-1'],
      })
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-nodate' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(bookingId).toBeTruthy()
  })
})
