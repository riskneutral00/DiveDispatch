/**
 * L8-12: Unit tests for createDraftShell mutation.
 *
 * Verifies that createDraftShell creates a minimal Draft booking shell
 * when called by an authorized operator, and rejects unauthorized callers.
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testDate } from '../helpers/dates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeT() {
  return convexTest(schema, import.meta.glob('../../convex/**/*.ts'))
}

type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

async function seedUser(
  ctx: Ctx,
  slug: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  role: any = 'DiveCenter',
) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    role,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

/** Seed minimal resources + preferences so profile + coverage gates pass */
async function seedCoverage(ctx: Ctx, operatorSlug: string, operatorUserId: Id<'users'>) {
  // DiveCenter profile record
  await ctx.db.insert('diveCenters', {
    userId: operatorUserId,
    name: 'Test DC',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: `${operatorSlug}@test.com`,
    contactPhone: '+66123456789',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    associations: [{ agency: 'PADI', number: '12345' }] as any,
    focusedLanguages: ['en'],
    verified: true,
  })
  // Booking template (Quick Book pill)
  await ctx.db.insert('bookingTemplates', {
    ownerId: operatorSlug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownerType: 'DiveCenter' as any,
    name: 'Default',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activityType: ['DSD'] as any,
    createdAt: Date.now(),
  })
  // Instructor user
  await ctx.db.insert('users', {
    tokenIdentifier: 'clerk|instr-cov', slug: 'instr-cov', email: 'i@t.com',
    name: 'Instr', firstName: 'I', lastName: 'C', businessName: 'IC',
    role: 'Instructor' as never, isSeeded: false, preferredLocale: 'en',
  })
  // Equipment user
  await ctx.db.insert('users', {
    tokenIdentifier: 'clerk|em-cov', slug: 'em-cov', email: 'e@t.com',
    name: 'EM', firstName: 'E', lastName: 'M', businessName: 'EM',
    role: 'Equipment' as never, isSeeded: false, preferredLocale: 'en',
  })
  // Venue user + venue record (confined + open + compressor)
  const venueUser = await ctx.db.insert('users', {
    tokenIdentifier: 'clerk|venue-cov', slug: 'venue-cov', email: 'v@t.com',
    name: 'Venue', firstName: 'V', lastName: 'C', businessName: 'VC',
    role: 'Pool' as never, isSeeded: false, preferredLocale: 'en',
  })
  await ctx.db.insert('venues', {
    userId: venueUser, name: 'Test Venue', placeName: 'Test', country: 'TH', lat: 0, lng: 0,
    focusedLanguages: ['en'], verified: true, venueType: 'Pool' as never,
    isPublic: false, confinedCapable: true, openWaterCapable: true, hasCompressor: true,
  })
  // Preferences
  await ctx.db.insert('stakeholderPreferences', {
    stakeholderId: operatorSlug, stakeholderType: 'DiveCenter' as never,
    acceptanceMode: 'Auto' as never, maxHoursPerDay: 8,
    postJobBlockDuration: 0, useNamedUnits: false,
    commonLanguageCodes: ['en'], confirmOnAccept: false, confirmOnDecline: false,
    preferredInstructorSlugs: ['instr-cov'],
    preferredEquipmentSlugs: ['em-cov'],
    preferredVenueSlugs: ['venue-cov'],
    preferredBoatSlugs: [],
    preferredCompressorSlugs: [],
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createDraftShell', () => {
  it('creates booking with Draft status', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-shell-1')
      await seedCoverage(ctx, 'dc-shell-1', userId)
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-shell-1' })
      .mutation(api.bookingDraftMutations.createDraftShell, {})

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as unknown as Id<'bookings'>)
      expect(booking).not.toBeNull()
      expect(booking?.status).toBe('Draft')
    })
  })

  it('creates booking with correct initial fields (bookingFormComplete=false)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-shell-2')
      await seedCoverage(ctx, 'dc-shell-2', userId)
    })

    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-shell-2' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        startDate: testDate(5),
        endDate: testDate(5),
      })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as unknown as Id<'bookings'>)
      expect(booking?.bookingFormComplete).toBe(false)
      expect(booking?.customerFormComplete).toBe(false)
      expect(booking?.medicalHardBlock).toBe(false)
      expect(booking?.ownerId).toBe('dc-shell-2')
      expect(booking?.startDate).toBe(testDate(5))
      expect(booking?.endDate).toBe(testDate(5))

      // No sessions created yet — those come from submitToDraft
      const sessions = await ctx.db.query('bookingSessions').collect()
      const bookingSessions = sessions.filter((s) => s.bookingId === bookingId)
      expect(bookingSessions).toHaveLength(0)
    })
  })

  it('rejects non-operator caller (FORBIDDEN)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, 'instructor-shell', 'Instructor')
    })

    await expect(
      t
        .withIdentity({ tokenIdentifier: 'clerk|instructor-shell' })
        .mutation(api.bookingDraftMutations.createDraftShell, {}),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      return (data as Record<string, unknown>)?.code === 'FORBIDDEN'
    })
  })
})
