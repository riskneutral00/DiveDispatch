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
import { _toggleBlockedDate } from '../convex/availability'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
  seedBooking,
  seedSession,
  seedReservation,
} from './fixtures/seedFixture'
import { testDate } from './helpers/dates'

const modules = import.meta.glob('../convex/**/*.ts')
let t = convexTest(schema, modules)
beforeEach(() => {
  t = convexTest(schema, modules)
})

// Helper: set up a booking with an instructor
async function setupBookingWithInstructor(ctx: Parameters<typeof _toggleBlockedDate>[0], opts?: { instructorSlug?: string; instructorToken?: string; date?: string }) {
  const instrSlug = opts?.instructorSlug ?? TEST_SLUGS.instructor
  const instrToken = opts?.instructorToken ?? TEST_TOKENS.instructor
  const date = opts?.date ?? testDate(5)

  // Seed DC user
  await seedUser(ctx, { slug: TEST_SLUGS.diveCenter, tokenIdentifier: TEST_TOKENS.diveCenter, role: 'DiveCenter' })
  // Seed instructor user
  await seedUser(ctx, { slug: instrSlug, tokenIdentifier: instrToken, role: 'Instructor', businessName: 'Instructor Co' })

  // Create inventory unit for instructor
  const unitId = await seedInventoryUnit(ctx, {
    resourceType: 'Instructor',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId: instrSlug,
    ownerType: 'Instructor',
    displayName: 'Test Instructor',
  })

  // Create booking owned by DC
  const bookingId = await seedBooking(ctx, {
    ownerId: TEST_SLUGS.diveCenter,
    startDate: date,
    endDate: date,
  })

  // Create session + reservation + snapshot
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
    await t.run(async (ctx) => {
      const { bookingId, instrSlug, instrToken, date } = await setupBookingWithInstructor(ctx)

      // Instructor blocks the date
      await _toggleBlockedDate(
        { ...ctx, auth: { getUserIdentity: async () => ({ tokenIdentifier: instrToken }) } } as Parameters<typeof _toggleBlockedDate>[0],
        { date, roleType: 'Instructor' },
      )

      // Booking MUST still exist
      const booking = await ctx.db.get(bookingId)
      expect(booking).not.toBeNull()
      expect(booking!.status).toBe('Draft')
    })
  })

  it('2. inventory snapshot restored after instructor blocks date', async () => {
    await t.run(async (ctx) => {
      const { unitId, instrToken, date } = await setupBookingWithInstructor(ctx)

      await _toggleBlockedDate(
        { ...ctx, auth: { getUserIdentity: async () => ({ tokenIdentifier: instrToken }) } } as Parameters<typeof _toggleBlockedDate>[0],
        { date, roleType: 'Instructor' },
      )

      // Snapshot should show available again
      const snapshots = await ctx.db
        .query('availabilitySnapshots')
        .filter((q: any) => q.eq(q.field('inventoryUnitId'), unitId))
        .collect()
      expect(snapshots.length).toBeGreaterThan(0)
      expect(snapshots[0].availableUnits).toBe(1)
      expect(snapshots[0].reservedUnits).toBe(0)
    })
  })

  it('3. reservation vacated after instructor blocks date', async () => {
    await t.run(async (ctx) => {
      const { reservationId, instrToken, date } = await setupBookingWithInstructor(ctx)

      await _toggleBlockedDate(
        { ...ctx, auth: { getUserIdentity: async () => ({ tokenIdentifier: instrToken }) } } as Parameters<typeof _toggleBlockedDate>[0],
        { date, roleType: 'Instructor' },
      )

      const reservation = await ctx.db.get(reservationId)
      expect(reservation!.status).toBe('Vacated')
      expect(reservation!.vacatedBy).toBe('stakeholder_declined')
    })
  })
})

// ─── Auto-advance gate tests ──────────────────────────────────────────────────

describe('auto-advance blocked when instructor missing', () => {
  it('6. booking with vacated instructor reservation cannot auto-advance', async () => {
    await t.run(async (ctx) => {
      const { bookingId, reservationId } = await setupBookingWithInstructor(ctx)

      // Set booking conditions for auto-advance (except instructor)
      await ctx.db.patch(bookingId, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })

      // Vacate the instructor reservation (simulates decline)
      await ctx.db.patch(reservationId, {
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'stakeholder_declined',
      })

      // Import and call tryAutoAdvance
      const { tryAutoAdvance } = await import('../convex/bookings/_shared')
      await tryAutoAdvance(ctx, bookingId)

      // Booking should still be Draft — not Upcoming
      const booking = await ctx.db.get(bookingId)
      expect(booking!.status).toBe('Draft')
    })
  })
})
