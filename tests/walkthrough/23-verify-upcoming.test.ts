/**
 * @module-tag slow
 */

/**
 * L8-23: Unit tests for tryAutoAdvance — Draft → Upcoming transition.
 *
 * Verifies all 4 blocking conditions from CLAUDE.md State Transitions:
 * 1. Advances to Upcoming when all 4 conditions met:
 *    bookingFormComplete + customerFormComplete + allConfirmed + !medicalHardBlock
 * 2. Does NOT advance without bookingFormComplete
 * 3. Does NOT advance without customerFormComplete
 * 4. Does NOT advance with unconfirmed (PendingAcceptance) reservations
 * 5. Does NOT advance with medicalHardBlock=true
 */

import { describe, it, expect } from 'vitest'
import { tryAutoAdvance } from '../../convex/bookings/_shared'
import type { Id } from '../../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../../convex/lib/auth'
import { testDate } from '../helpers/dates'
import { makeT } from '../helpers/convex-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

async function seedBookingWithConditions(
  ctx: Ctx,
  ownerId: string,
  conditions: {
    bookingFormComplete: boolean
    customerFormComplete: boolean
    medicalHardBlock: boolean
  },
): Promise<Id<'bookings'>> {
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
    ...conditions,
  })
}

async function seedConfirmedReservation(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  ownerId: string,
): Promise<void> {
  const unitId = await ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: `${ownerId} Unit`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Instructor',
  })
  const sessionId = await ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date: testDate(5),
    startTime: '08:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
  })
  await ctx.db.insert('reservations', {
    bookingId,
    inventoryUnitId: unitId,
    bookingSessionId: sessionId,
    unitsRequested: 1,
    status: 'Confirmed',
    confirmedAt: Date.now(),
  })
}

async function seedPendingReservation(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  ownerId: string,
): Promise<void> {
  const unitId = await ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: `${ownerId} Unit`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Instructor',
  })
  const sessionId = await ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date: testDate(5),
    startTime: '08:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
  })
  await ctx.db.insert('reservations', {
    bookingId,
    inventoryUnitId: unitId,
    bookingSessionId: sessionId,
    unitsRequested: 1,
    status: 'PendingAcceptance',
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('tryAutoAdvance', () => {
  it('transitions to Upcoming when all 4 conditions are met', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await seedBookingWithConditions(ctx, 'dc-aa-1', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      // All reservations confirmed
      await seedConfirmedReservation(ctx, bookingId, 'inst-aa-1')
      return bookingId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')
    })
  })

  it('does NOT advance with missing bookingFormComplete', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await seedBookingWithConditions(ctx, 'dc-aa-2', {
        bookingFormComplete: false, // missing
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedConfirmedReservation(ctx, bookingId, 'inst-aa-2')
      return bookingId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')
    })
  })

  it('does NOT advance with missing customerFormComplete', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await seedBookingWithConditions(ctx, 'dc-aa-3', {
        bookingFormComplete: true,
        customerFormComplete: false, // missing
        medicalHardBlock: false,
      })
      await seedConfirmedReservation(ctx, bookingId, 'inst-aa-3')
      return bookingId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')
    })
  })

  it('does NOT advance with unconfirmed (PendingAcceptance) reservations', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await seedBookingWithConditions(ctx, 'dc-aa-4', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      // Reservation is still pending — blocks advance
      await seedPendingReservation(ctx, bookingId, 'inst-aa-4')
      return bookingId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')
    })
  })

  it('does NOT advance with medicalHardBlock=true', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await seedBookingWithConditions(ctx, 'dc-aa-5', {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: true, // hard block
      })
      await seedConfirmedReservation(ctx, bookingId, 'inst-aa-5')
      return bookingId
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')
    })
  })
})
