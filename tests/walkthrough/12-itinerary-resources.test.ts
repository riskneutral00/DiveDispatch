/**
 * @module-tag slow
 */

/**
 * L8-12: Unit tests for createDraftShell mutation.
 *
 * Verifies that createDraftShell creates a minimal Draft booking shell
 * when called by an authorized operator, and rejects unauthorized callers.
 */

import { describe, it, expect, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testDate } from '../helpers/dates'
import {
  seedUser as _seedUser,
  seedDiveCenterProfile,
  seedBookingTemplate,
  seedVenue,
  seedStakeholderPreferences,
  type SeedCtx, findProfileByUser } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'


async function seedUser(ctx: SeedCtx, slug: string, role: NonNullable<Parameters<typeof _seedUser>[1]>['role'] = 'DiveCenter') {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: `${slug} Display`, firstName: slug, lastName: 'Test', role })
}

async function seedCoverage(ctx: SeedCtx, operatorSlug: string, operatorUserId: Id<'users'>) {
  await ctx.db.patch(operatorUserId, { phone: '+66123456789', appLanguage: 'en' })
  await seedDiveCenterProfile(ctx, operatorUserId, { email: `${operatorSlug}@test.com` })
  const dc = await findProfileByUser(ctx, operatorUserId, 'diveCenters')
  if (dc) await ctx.db.patch(dc._id, { customerLanguages: ['en'] })
  await seedBookingTemplate(ctx, { ownerId: operatorSlug, activityType: ['DSD'] })
  await _seedUser(ctx, { tokenIdentifier: 'clerk|instr-cov', slug: 'instr-cov', email: 'i@t.com', name: 'Instr', firstName: 'I', lastName: 'C', role: 'Instructor' })
  await _seedUser(ctx, { tokenIdentifier: 'clerk|em-cov', slug: 'em-cov', email: 'e@t.com', name: 'EM', firstName: 'E', lastName: 'M', role: 'Equipment' })
  const venueUser = await _seedUser(ctx, { tokenIdentifier: 'clerk|venue-cov', slug: 'venue-cov', email: 'v@t.com', name: 'Venue', firstName: 'V', lastName: 'C', role: 'Venue' })
  await seedVenue(ctx, { userId: venueUser, name: 'Test Venue', placeName: 'Test', country: 'TH', lat: 0, lng: 0, confinedCapable: true })
  await seedStakeholderPreferences(ctx, operatorSlug, {
    confirmOnAccept: false,
    confirmOnDecline: false,
    preferredInstructorSlugs: ['instr-cov'],
    preferredEquipmentSlugs: ['em-cov'],
    preferredVenueSlugs: ['venue-cov'],
    preferredBoatSlugs: [],
    preferredCompressorSlugs: ['venue-cov'],
  })
}


describe('createDraftShell', () => {
  it('creates booking with Draft status', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'dc-shell-1')
      await seedCoverage(ctx, 'dc-shell-1', userId)
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-shell-1' })
      .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'DiveCenter' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as Id<'bookings'>)
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

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-shell-2' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        activeRole: 'DiveCenter',
        startDate: testDate(5),
        endDate: testDate(5),
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId as Id<'bookings'>)
      expect(booking?.bookingFormComplete).toBe(false)
      expect(booking?.customerFormComplete).toBe(false)
      expect(booking?.medicalHardBlock).toBe(false)
      expect(booking?.ownerId).toBe('dc-shell-2')
      expect(booking?.startDate).toBe(testDate(5))
      expect(booking?.endDate).toBe(testDate(5))

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
        .mutation(api.bookingDraftMutations.createDraftShell, { activeRole: 'DiveCenter' }),
    ).rejects.toSatisfy((err: unknown) => {
      const e = err as { data: unknown }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      return (data as Record<string, unknown>)?.code === 'ROLE_NOT_HELD'
    })
  })
})
