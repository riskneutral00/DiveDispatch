/**
 * activeRole — Behavioral Tests for Role Activation Pattern
 *
 * Tests that mutations accept an activeRole parameter, validate it
 * against the user's assigned roles, and use it for ownership stamping.
 *
 * Rejection tests (ROLE_NOT_HELD, FORBIDDEN) fire before the profile
 * completeness gate, so they need minimal seeding. Happy-path tests
 * need full profile seeding to pass the gate.
 */

import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  seedUser,
  seedDiveCenterProfile,
  seedAgent,
  seedBookingTemplate,
  seedStakeholderPreferences,
  seedInstructorProfile,
  seedVenue,
  type SeedCtx, findProfileByUser } from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'

// ─── Composite helper ────────────────────────────────────────────────────────

/** Seed a user with full DC profile that passes all booking gates. */
async function seedFullDc(ctx: SeedCtx, slug: string) {
  const userId = await seedUser(ctx, {
    slug,
    tokenIdentifier: `clerk|${slug}`,
    role: 'DiveCenter',
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
  })
  // Set profile + settings layer fields
  await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
  await seedDiveCenterProfile(ctx, userId, {
    name: 'Test Dive Center',
    email: `${slug}@test.com`,
  })
  // Set customerLanguages on diveCenters (required field)
  const dc = await findProfileByUser(ctx, userId, 'diveCenters')
  if (dc) await ctx.db.patch(dc._id, { customerLanguages: ['en'] })
  await seedBookingTemplate(ctx, {
    ownerId: slug,
    ownerType: 'DiveCenter',
    name: 'DSD',
    activityType: ['DSD'],
  })

  // Coverage resources
  const instrSlug = `instr-${slug}`
  const equipSlug = `equip-${slug}`
  const venueSlug = `venue-${slug}`
  const compSlug = `comp-${slug}`

  await seedStakeholderPreferences(ctx, slug, {
    stakeholderType: 'DiveCenter',
    commonLanguageCodes: [],
    confirmOnAccept: false,
    confirmOnDecline: false,
    preferredInstructorSlugs: [instrSlug],
    preferredEquipmentSlugs: [equipSlug],
    preferredVenueSlugs: [venueSlug],
    preferredCompressorSlugs: [compSlug],
  })
  await seedUser(ctx, { slug: instrSlug, tokenIdentifier: `clerk|${instrSlug}`, role: 'Instructor', email: `${instrSlug}@t.com`, name: 'I', firstName: 'I', lastName: 'T' })
  await seedUser(ctx, { slug: equipSlug, tokenIdentifier: `clerk|${equipSlug}`, role: 'Equipment', email: `${equipSlug}@t.com`, name: 'E', firstName: 'E', lastName: 'T' })
  const vUserId = await seedUser(ctx, { slug: venueSlug, tokenIdentifier: `clerk|${venueSlug}`, role: 'Pool', email: `${venueSlug}@t.com`, name: 'V', firstName: 'V', lastName: 'T' })
  await seedVenue(ctx, { userId: vUserId, name: 'Pool', hasCompressor: false, venueCategory: 'pool' })
  await seedUser(ctx, { slug: compSlug, tokenIdentifier: `clerk|${compSlug}`, role: 'Compressor', email: `${compSlug}@t.com`, name: 'C', firstName: 'C', lastName: 'T' })

  return userId
}

// ─── Rejection tests (fire before profile gate) ─────────────────────────────

describe('createDraftShell — activeRole validation', () => {
  it('rejects when activeRole is not held by the user', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-rej-1', tokenIdentifier: 'clerk|dc-rej-1' })
    })

    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-rej-1' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Liveaboard',
        }),
      'ROLE_NOT_HELD',
    )
  })

  it('rejects when activeRole is a resource role (not operator)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { slug: 'dc-rej-2', tokenIdentifier: 'clerk|dc-rej-2' })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
      })
    })

    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-rej-2' })
        .mutation(api.bookingDraftMutations.createDraftShell, {
          activeRole: 'Instructor',
        }),
      'FORBIDDEN',
    )
  })
})

// ─── Happy-path tests (need full profile seeding) ───────────────────────────

describe('createDraftShell — activeRole ownership stamping', () => {
  it('stamps ownerType from activeRole DiveCenter', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedFullDc(ctx, 'dc-own-1')
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-own-1' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        activeRole: 'DiveCenter',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof bookingId).toBe('string')

    let ownerType: string | undefined
    await t.run(async (ctx) => {
      const booking = await ctx.db
        .query('bookings')
        .filter((q) => q.eq(q.field('ownerId'), 'dc-own-1'))
        .first()
      ownerType = booking?.ownerType
    })
    expect(ownerType).toBe('DiveCenter')
  })

  it('stamps ownerType Agent when multi-role user passes activeRole Agent', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedFullDc(ctx, 'dc-own-2')
      // Add Agent role + profile
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Agent',
        createdAt: Date.now(),
      })
      await seedAgent(ctx, userId)
      await seedBookingTemplate(ctx, {
        ownerId: 'dc-own-2',
        ownerType: 'Agent',
        name: 'Agent Template',
        activityType: ['DSD'],
      })
    })

    vi.useFakeTimers({ now: Date.now() })
    const bookingId = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-own-2' })
      .mutation(api.bookingDraftMutations.createDraftShell, {
        activeRole: 'Agent',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    let ownerType: string | undefined
    await t.run(async (ctx) => {
      const booking = await ctx.db
        .query('bookings')
        .filter((q) => q.eq(q.field('ownerId'), 'dc-own-2'))
        .first()
      ownerType = booking?.ownerType
    })
    expect(ownerType).toBe('Agent')
  })
})
