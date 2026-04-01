/**
 * Instructor Decline Cascade Tests (TDD)
 *
 * When an instructor blocks a date or declines a booking:
 * 1. Their reservation is vacated, inventory restored
 * 2. Booking survives (not deleted) — stays on DC dashboard
 * 3. System auto-sends to preferred backup instructor (if available)
 * 4. If no backup → booking stays Draft, becomes Urgent
 * 5. Missing instructor blocks auto-advance to Upcoming
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
  seedBooking,
  seedSession,
  seedReservation,
} from './fixtures'
import { testDate } from './helpers/dates'
import type { Id } from '../convex/_generated/dataModel'

const modules = import.meta.glob('../convex/**/*.ts')
let t = convexTest(schema, modules)
beforeEach(() => {
  t = convexTest(schema, modules)
})

type SetupResult = {
  unitId: Id<'inventoryUnits'>
  bookingId: Id<'bookings'>
  sessionId: Id<'bookingSessions'>
  reservationId: Id<'reservations'>
  instrSlug: string
  instrToken: string
  date: string
}

async function setupBookingWithInstructor(ctx: Parameters<Parameters<typeof t.run>[0]>[0], opts?: { instructorSlug?: string; instructorToken?: string; date?: string }): Promise<SetupResult> {
  const instrSlug = opts?.instructorSlug ?? TEST_SLUGS.instructor
  const instrToken = opts?.instructorToken ?? TEST_TOKENS.instructor
  const date = opts?.date ?? testDate(5)

  await seedUser(ctx, { slug: TEST_SLUGS.diveCenter, tokenIdentifier: TEST_TOKENS.diveCenter, role: 'DiveCenter' })
  await seedUser(ctx, { slug: instrSlug, tokenIdentifier: instrToken, role: 'Instructor', businessName: 'Instructor Co' })

  const unitId = await seedInventoryUnit(ctx, {
    resourceType: 'Instructor',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId: instrSlug,
    ownerType: 'Instructor',
    displayName: 'Test Instructor',
  })

  const bookingId = await seedBooking(ctx, {
    ownerId: TEST_SLUGS.diveCenter,
    startDate: date,
    endDate: date,
  })

  const sessionId = await seedSession(ctx, bookingId, unitId, { date })
  const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId)
  await seedSnapshot(ctx, unitId, {
    date,
    totalUnits: 1,
    reservedUnits: 1,
    availableUnits: 0,
  })

  return { unitId, bookingId, sessionId, reservationId, instrSlug, instrToken, date }
}

// ─── Block-date cascade tests ─────────────────────────────────────────────────

describe('instructor blocks date — booking cascade', () => {
  it('1. booking survives on DC dashboard after instructor blocks date', async () => {
    let date = ''
    let bookingId: Id<'bookings'> | null = null

    await t.run(async (ctx) => {
      const result = await setupBookingWithInstructor(ctx)
      date = result.date
      bookingId = result.bookingId
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.availability.toggleBlockedDate, { date, roleType: 'Instructor' })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId!)
      expect(booking).not.toBeNull()
      expect(booking!.status).toBe('Draft')
    })
  })

  it('2. inventory snapshot restored after instructor blocks date', async () => {
    let date = ''
    let unitId: Id<'inventoryUnits'> | null = null

    await t.run(async (ctx) => {
      const result = await setupBookingWithInstructor(ctx)
      date = result.date
      unitId = result.unitId
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.availability.toggleBlockedDate, { date, roleType: 'Instructor' })

    await t.run(async (ctx) => {
      const snapshots = await ctx.db
        .query('availabilitySnapshots')
        .collect()
      const snapshot = snapshots.find((s) => s.inventoryUnitId === unitId)
      expect(snapshot).not.toBeNull()
      expect(snapshot!.availableUnits).toBe(1)
      expect(snapshot!.reservedUnits).toBe(0)
    })
  })

  it('3. reservation vacated after instructor blocks date', async () => {
    let date = ''
    let reservationId: Id<'reservations'> | null = null

    await t.run(async (ctx) => {
      const result = await setupBookingWithInstructor(ctx)
      date = result.date
      reservationId = result.reservationId
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.availability.toggleBlockedDate, { date, roleType: 'Instructor' })

    await t.run(async (ctx) => {
      const reservation = await ctx.db.get(reservationId!)
      expect(reservation!.status).toBe('Vacated')
      expect(reservation!.vacatedBy).toBe('date_blocked')
    })
  })

  it('4. booking marked needsAttention after instructor blocks date', async () => {
    let date = ''
    let bookingId: Id<'bookings'> | null = null

    await t.run(async (ctx) => {
      const result = await setupBookingWithInstructor(ctx)
      date = result.date
      bookingId = result.bookingId
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.availability.toggleBlockedDate, { date, roleType: 'Instructor' })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId!)
      expect(booking!.needsAttention).toBe(true)
    })
  })

  it('7. booking with pre-vacated reservation is NOT marked needsAttention after date block', async () => {
    let date = ''
    let bookingId: Id<'bookings'> | null = null

    await t.run(async (ctx) => {
      const result = await setupBookingWithInstructor(ctx)
      date = result.date
      bookingId = result.bookingId

      await ctx.db.patch(result.reservationId, {
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'stakeholder_declined',
      })
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.availability.toggleBlockedDate, { date, roleType: 'Instructor' })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId!)
      expect(booking!.needsAttention).not.toBe(true)
    })
  })
})

// ─── Auto-advance gate tests ──────────────────────────────────────────────────

describe('auto-advance blocked when instructor missing', () => {
  it('5. toggleBlockedDate cascade blocks auto-advance to Upcoming', async () => {
    let date = ''
    let bookingId: Id<'bookings'> | null = null
    let reservationId: Id<'reservations'> | null = null

    await t.run(async (ctx) => {
      const result = await setupBookingWithInstructor(ctx)
      date = result.date
      bookingId = result.bookingId
      reservationId = result.reservationId

      await ctx.db.patch(result.bookingId, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.availability.toggleBlockedDate, { date, roleType: 'Instructor' })

    await t.run(async (ctx) => {
      const reservation = await ctx.db.get(reservationId!)
      expect(reservation!.vacatedBy).toBe('date_blocked')

      const { tryAutoAdvance } = await import('../convex/bookings/_shared')
      await tryAutoAdvance(ctx, bookingId!)

      const booking = await ctx.db.get(bookingId!)
      expect(booking!.status).toBe('Draft')
    })
  })

  it('6. booking with vacated instructor reservation cannot auto-advance', async () => {
    await t.run(async (ctx) => {
      const { bookingId, reservationId } = await setupBookingWithInstructor(ctx)

      await ctx.db.patch(bookingId, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })

      await ctx.db.patch(reservationId, {
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'stakeholder_declined',
      })

      const { tryAutoAdvance } = await import('../convex/bookings/_shared')
      await tryAutoAdvance(ctx, bookingId)

      const booking = await ctx.db.get(bookingId)
      expect(booking!.status).toBe('Draft')
    })
  })
})
