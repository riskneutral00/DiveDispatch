/**
 * Coverage Gate — Integration Tests
 *
 * Validates that createDraftShell rejects booking creation when the
 * operator's preferred resources don't satisfy all 4 coverage requirements
 * (instructor, equipment, venue/boat, compressor).
 */

import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { testDate } from './helpers/dates'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import {
  seedUserWithOrg as seedUserBySlug,
  seedStakeholderPreferences,
  seedDiveCenterProfile,
  seedBookingTemplate,
  seedVenue,
  getOrCreateTestOrg,
  type SeedCtx, findProfileByUser } from './fixtures'

async function seedVenueUser(
  ctx: SeedCtx,
  slug: string,
  caps: { confinedCapable: boolean },
) {
  const userId = await seedUserBySlug(ctx, slug, 'Venue')
  await seedVenue(ctx, {
    userId,
    name: `${slug} Venue`,
    confinedCapable: caps.confinedCapable,
  })
}

async function seedBoatUser(ctx: SeedCtx, slug: string, hasCompressor: boolean) {
  const userId = await seedUserBySlug(ctx, slug, 'Boat')
  const organizationId = await getOrCreateTestOrg(ctx, userId, `${slug} Boat`)
  const boatId = await ctx.db.insert('boats', {
    organizationId,
    slug: `boat-${slug}`,
    name: `${slug} Boat`,
    address: { city: 'Koh Tao', country: 'TH' },
    lat: 10.0957,
    lng: 99.8408,
    email: `${slug}@test.com`,
    phone: '+66123456789',
    fleet: [],
    verified: true,
  })
  if (hasCompressor) {
    await ctx.db.patch(boatId, { gasMixes: ['air'] })
  }
}

/** Seed diveCenters profile + bookingTemplates + user fields so profileCompleteness gate passes */
async function seedDCProfile(ctx: SeedCtx, userId: Id<'users'>, slug: string) {
  // Profile + settings layer on users table
  await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
  await seedDiveCenterProfile(ctx, userId, { email: `${slug}@test.com` })
  const dc = await findProfileByUser(ctx, userId, 'diveCenters')
  if (dc) await ctx.db.patch(dc._id, { customerLanguages: ['en'] })
  await seedBookingTemplate(ctx, { ownerId: slug, activityType: ['DSD'] })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createDraftShell — coverage gate', () => {
  it('rejects with PROFILE_INCOMPLETE when only instructor is in preferences (missing equipment/venue)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserBySlug(ctx, 'dc-noprofs', 'DiveCenter')
      await seedDCProfile(ctx, userId,'dc-noprofs')
      await seedUserBySlug(ctx, 'inst-gate', 'Instructor')
      await seedStakeholderPreferences(ctx, 'dc-noprofs', {
        preferredInstructorSlugs: ['inst-gate'],
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-noprofs' }).mutation(
        api.bookingDraftMutations.createDraftShell,
        { activeRole: 'DiveCenter', startDate: testDate(5) },
      ),
      'PROFILE_INCOMPLETE',
    )
  })

  it('rejects with PROFILE_INCOMPLETE listing missing equipment and venue when only instructor pref is set', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserBySlug(ctx, 'dc-empty', 'DiveCenter')
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
        { activeRole: 'DiveCenter', startDate: testDate(5) },
      ),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      const d = data as { code: string; missing: string[] }
      return (
        d.code === 'PROFILE_INCOMPLETE' &&
        d.missing.includes('preferredEquipment') &&
        d.missing.includes('preferredVenue') &&
        d.missing.includes('preferredBoat') &&
        d.missing.includes('preferredCompressor')
      )
    })
  })

  it('rejects when only instructor is preferred (missing equipment, venue)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserBySlug(ctx, 'dc-partial', 'DiveCenter')
      await seedDCProfile(ctx, userId,'dc-partial')
      await seedUserBySlug(ctx, 'inst-1', 'Instructor')
      await seedStakeholderPreferences(ctx, 'dc-partial', {
        preferredInstructorSlugs: ['inst-1'],
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-partial' }).mutation(
        api.bookingDraftMutations.createDraftShell,
        { activeRole: 'DiveCenter', startDate: testDate(5) },
      ),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      const d = data as { code: string; missing: string[] }
      return (
        d.code === 'PROFILE_INCOMPLETE' &&
        !d.missing.includes('preferredInstructor') &&
        d.missing.includes('preferredEquipment')
      )
    })
  })

  it('succeeds when all 5 coverage requirements are met via venue + standalone compressor', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserBySlug(ctx, 'dc-full', 'DiveCenter')
      await seedDCProfile(ctx, userId,'dc-full')
      await seedUserBySlug(ctx, 'inst-1', 'Instructor')
      await seedUserBySlug(ctx, 'equip-1', 'Equipment')
      await seedUserBySlug(ctx, 'comp-1', 'Compressor')
      await seedVenueUser(ctx, 'venue-1', {
        confinedCapable: true,
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
        activeRole: 'DiveCenter',
        startDate: testDate(5),
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')

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
      const userId = await seedUserBySlug(ctx, 'dc-boat', 'DiveCenter')
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
        activeRole: 'DiveCenter',
        startDate: testDate(5),
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')
  })

  it('succeeds without startDate arg (optional dates)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUserBySlug(ctx, 'dc-nodate', 'DiveCenter')
      await seedDCProfile(ctx, userId,'dc-nodate')
      await seedUserBySlug(ctx, 'inst-1', 'Instructor')
      await seedUserBySlug(ctx, 'equip-1', 'Equipment')
      await seedUserBySlug(ctx, 'comp-1', 'Compressor')
      await seedVenueUser(ctx, 'venue-1', {
        confinedCapable: true,
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
      .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'DiveCenter' })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')
  })
})
