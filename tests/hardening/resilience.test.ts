import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { testDate, testToken } from '../helpers/dates'
import { seedUser, seedBooking as _seedBooking, type SeedCtx } from '../fixtures/seedFixture'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000
const modules = import.meta.glob('../../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
}

async function seedBooking(ctx: SeedCtx, ownerId: string, overrides: Parameters<typeof _seedBooking>[1] = {}) {
  return _seedBooking(ctx, { ownerId, bookingFormComplete: false, ...overrides })
}

async function seedExclusiveInstructor(ctx: SeedCtx, ownerSlug: string = 'instructor-1') {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerSlug,
    displayName: 'Instructor One',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId: ownerSlug,
    ownerType: 'Instructor',
  })
}

// ─── L9-14: Stale Data Scenarios ─────────────────────────────────────────────

describe('L9-14: Cancel booking → accept reservation → INVALID_STATUS', () => {
  it('accepting a vacated reservation (from cancelled booking) throws INVALID_STATUS', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instructor-1', tokenIdentifier: 'clerk|instructor-1', role: 'Instructor' })
      const bookingId = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingId, unitId }
    })

    // Submit booking → creates PendingAcceptance reservation
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    // Get the reservation ID
    const reservationId = await t.run(async (ctx) => {
      const res = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingId))
        .collect()
      return res[0]._id
    })

    // Cancel the booking → vacates reservation
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    // Verify reservation is now Vacated
    const res = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(res!.status).toBe('Vacated')
    expect(res!.vacatedBy).toBe('booking_cancelled')

    // Try to accept the vacated reservation → INVALID_STATUS
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
        .mutation(api.reservationsMutations.acceptReservation, { reservationId }),
      'INVALID_STATUS',
    )
  })
})

describe('L9-14: Expire booking → portal submit → rejected', () => {
  it('portal submit after booking expiry is rejected', async () => {
    const t = makeT()

    // Seed an expired Draft booking + portal fixture
    const { bookingId, token } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, 'dc-test', {
        expiresAt: Date.now() - 1000, // Already expired
      })

      const token = testToken()
      await ctx.db.insert('bookingLinks', {
        bookingId,
        token,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        customerName: 'Alice',
        email: 'alice@example.com',
      })
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: token,
      })

      return { bookingId, token }
    })

    // Expire the booking
    await t.mutation(api.bookings.status.expireBooking, { bookingId })

    // Verify booking is now Cancelled
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Cancelled')

    // Portal submit → rejected (booking is Cancelled, not Draft)
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'BOOKING_CLOSED',
    )
  })
})

describe('L9-14: Accept reservation → cancel booking → reservation vacated', () => {
  it('cancelling a booking vacates even Confirmed reservations', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instructor-1', tokenIdentifier: 'clerk|instructor-1', role: 'Instructor' })
      const bookingId = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingId, unitId }
    })

    // Submit booking
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    // Get reservation and accept it
    const reservationId = await t.run(async (ctx) => {
      const res = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingId))
        .collect()
      return res[0]._id
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|instructor-1' })
      .mutation(api.reservationsMutations.acceptReservation, { reservationId })

    // Verify reservation is Confirmed
    const confirmedRes = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(confirmedRes!.status).toBe('Confirmed')

    // Cancel the booking → should vacate the Confirmed reservation
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    // Verify reservation is now Vacated
    const vacatedRes = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(vacatedRes!.status).toBe('Vacated')
    expect(vacatedRes!.vacatedBy).toBe('booking_cancelled')

    // Verify snapshot restored — instructor should be available again
    const snapshot = await t.run(async (ctx) =>
      ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique(),
    )
    expect(snapshot!.availableUnits).toBe(1)
    expect(snapshot!.reservedUnits).toBe(0)
  })
})
