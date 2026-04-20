/**
 * @module-tag slow
 */

/**
 * L8-22: Unit tests for acceptByBookingForCaller mutation.
 *
 * Verifies:
 * 1. Transitions all caller's PendingAcceptance reservations to Confirmed
 * 2. Sets confirmedAt timestamp on each confirmed reservation
 * 3. Only affects caller's reservations — other stakeholders untouched
 * 4. Throws NOT_FOUND when no pending reservations exist for caller
 */

import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../../convex/lib/auth'
import { testDate } from '../helpers/dates'
import { makeT, expectConvexError } from '../helpers/convex-helpers'
import { getOrCreateTestOrg, type SeedCtx } from '../fixtures'

type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

type StakeholderRole = 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel' | 'DiveSite' | 'Boat' | 'Equipment' | 'Pool' | 'Compressor' | 'Instructor' | 'DiveMaster'

async function seedUser(
  ctx: Ctx,
  slug: string,
  role: StakeholderRole = 'Instructor',
) {
  const userId = await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    phone: '+66812345678',
    dateOfBirth: '1990-01-01',
    appLanguage: 'en',
  })
  if (role === 'Instructor') {
    const organizationId = await getOrCreateTestOrg(ctx as SeedCtx, userId, `${slug} Display`)
    await ctx.db.insert('diveStaff', {
      userId,
      organizationId,
      role: 'Instructor',
      name: `${slug} Display`,
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.0957,
      lng: 99.8408,
      email: `${slug}@test.com`,
      phone: '+66812345678',
      credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '12345', specialtyRatings: ['OW'] }],
      verified: true,
      teachingLanguages: ['en'],
    })
  }
  return userId
}

async function seedBooking(ctx: Ctx, ownerId: string): Promise<Id<'bookings'>> {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: testDate(5),
    endDate: testDate(5),
    divers: [],
    operatorName: `${ownerId} Business`,
    portalContact: true,
    portalMedical: true,
    portalWaiver: true,
    medicalHardBlock: false,
    bookingFormComplete: true,
    customerFormComplete: false,
  })
}

async function seedInventoryUnit(ctx: Ctx, ownerId: string): Promise<Id<'inventoryUnits'>> {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: `${ownerId} Unit`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Instructor',
  })
}

async function seedSession(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  unitId: Id<'inventoryUnits'>,
  date = testDate(5),
): Promise<Id<'bookingSessions'>> {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date,
    startTime: '08:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
  })
}

async function seedReservation(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  unitId: Id<'inventoryUnits'>,
  sessionId: Id<'bookingSessions'>,
  status: 'PendingAcceptance' | 'Confirmed' = 'PendingAcceptance',
): Promise<Id<'reservations'>> {
  return ctx.db.insert('reservations', {
    bookingId,
    inventoryUnitId: unitId,
    bookingSessionId: sessionId,
    unitsRequested: 1,
    status,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('acceptByBookingForCaller', () => {
  it('transitions all caller reservations to Confirmed', async () => {
    const t = makeT()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-accept-1', 'DiveCenter')
      await seedUser(ctx, 'inst-accept-1', 'Instructor')
      const bookingId = await seedBooking(ctx, 'dc-accept-1')
      const unitId = await seedInventoryUnit(ctx, 'inst-accept-1')
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId)
      return { bookingId, resId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|inst-accept-1' })
      .mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId })

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(res?.status).toBe('Confirmed')
    })
  })

  it('sets confirmedAt timestamp on accepted reservation', async () => {
    const t = makeT()

    const before = Date.now()

    const { bookingId, resId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-accept-2', 'DiveCenter')
      await seedUser(ctx, 'inst-accept-2', 'Instructor')
      const bookingId = await seedBooking(ctx, 'dc-accept-2')
      const unitId = await seedInventoryUnit(ctx, 'inst-accept-2')
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId)
      return { bookingId, resId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|inst-accept-2' })
      .mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId })

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(typeof res?.confirmedAt).toBe('number')
      expect(res!.confirmedAt as number).toBeGreaterThanOrEqual(before)
    })
  })

  it('only affects caller reservations — other stakeholder reservations unchanged', async () => {
    const t = makeT()

    const { bookingId, instResId, venueResId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-accept-3', 'DiveCenter')
      await seedUser(ctx, 'inst-accept-3', 'Instructor')
      await seedUser(ctx, 'pool-accept-3', 'Pool')
      const bookingId = await seedBooking(ctx, 'dc-accept-3')

      // Instructor unit
      const instUnitId = await seedInventoryUnit(ctx, 'inst-accept-3')
      const instSessionId = await seedSession(ctx, bookingId, instUnitId)
      const instResId = await seedReservation(ctx, bookingId, instUnitId, instSessionId)

      // Pool unit (different stakeholder)
      const poolUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Pool',
        resourceId: 'pool-accept-3',
        displayName: 'Pool Unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'pool-accept-3',
        ownerType: 'Pool',
      })
      const poolSessionId = await seedSession(ctx, bookingId, poolUnitId, testDate(5))
      const venueResId = await seedReservation(ctx, bookingId, poolUnitId, poolSessionId)

      return { bookingId, instResId, venueResId }
    })

    // Only the instructor accepts
    await t
      .withIdentity({ tokenIdentifier: 'clerk|inst-accept-3' })
      .mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId })

    await t.run(async (ctx) => {
      // Instructor reservation confirmed
      const instRes = await ctx.db.get(instResId)
      expect(instRes?.status).toBe('Confirmed')

      // Pool reservation untouched
      const poolRes = await ctx.db.get(venueResId)
      expect(poolRes?.status).toBe('PendingAcceptance')
    })
  })

  it('throws NOT_FOUND when no pending reservations for caller', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-accept-4', 'DiveCenter')
      await seedUser(ctx, 'inst-accept-4', 'Instructor')
      const bookingId = await seedBooking(ctx, 'dc-accept-4')
      const unitId = await seedInventoryUnit(ctx, 'inst-accept-4')
      const sessionId = await seedSession(ctx, bookingId, unitId)
      // Already confirmed — no pending reservations
      await seedReservation(ctx, bookingId, unitId, sessionId, 'Confirmed')
      return { bookingId }
    })

    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|inst-accept-4' })
        .mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId }),
      'NOT_FOUND',
    )
  })
})
