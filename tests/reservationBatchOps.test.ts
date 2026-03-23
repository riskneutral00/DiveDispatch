/**
 * Reservation Batch Operations — Integration Tests
 *
 * Tests declineByBookingForCaller and acceptByBookingForCaller mutations.
 * These batch-process all of a caller's reservations on a booking at once.
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'
import {
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedSession,
  seedReservation,
  seedSnapshot,
  TEST_TOKENS,
  TEST_SLUGS,
} from './fixtures/seedFixture'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const modules = import.meta.glob('../convex/**/*.ts')

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

// ─── declineByBookingForCaller ───────────────────────────────────────────────

describe('declineByBookingForCaller', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      bookingId = await seedBooking(ctx)
    })

    await expect(
      t.mutation(api.reservationsMutations.declineByBookingForCaller, { bookingId }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when caller has no inventory units', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, { tokenIdentifier: 'test|no-units', slug: 'no-units', role: 'Instructor' })
      bookingId = await seedBooking(ctx)
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'test|no-units' })
        .mutation(api.reservationsMutations.declineByBookingForCaller, { bookingId }),
      'NOT_FOUND',
    )
  })

  it('rejects when no active reservations exist for caller on booking', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.instructor, slug: TEST_SLUGS.instructor, role: 'Instructor' })
      bookingId = await seedBooking(ctx)
      // Create inventory unit but NO reservation on this booking
      await seedInventoryUnit(ctx)
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
        .mutation(api.reservationsMutations.declineByBookingForCaller, { bookingId }),
      'NOT_FOUND',
    )
  })

  it('declines all active reservations for caller on the booking', async () => {
    const t = makeT()
    let bookingId: any
    let resId1: any
    let resId2: any

    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.instructor, slug: TEST_SLUGS.instructor, role: 'Instructor' })
      bookingId = await seedBooking(ctx)
      const unitId = await seedInventoryUnit(ctx)
      await seedSnapshot(ctx, unitId, { reservedUnits: 2, availableUnits: -1 })
      const session1 = await seedSession(ctx, bookingId, unitId)
      const session2 = await seedSession(ctx, bookingId, unitId, { date: undefined })
      resId1 = await seedReservation(ctx, bookingId, unitId, session1)
      resId2 = await seedReservation(ctx, bookingId, unitId, session2)
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.reservationsMutations.declineByBookingForCaller, { bookingId })

    await t.run(async (ctx) => {
      const res1 = await ctx.db.get(resId1) as Doc<'reservations'> | null
      const res2 = await ctx.db.get(resId2) as Doc<'reservations'> | null
      expect(res1!.status).toBe('Vacated')
      expect(res2!.status).toBe('Vacated')
    })
  })
})

// ─── acceptByBookingForCaller ────────────────────────────────────────────────

describe('acceptByBookingForCaller', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      bookingId = await seedBooking(ctx)
    })

    await expect(
      t.mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when caller has no pending reservations on booking', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.instructor, slug: TEST_SLUGS.instructor, role: 'Instructor' })
      bookingId = await seedBooking(ctx)
      await seedInventoryUnit(ctx)
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
        .mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId }),
      'NOT_FOUND',
    )
  })

  it('confirms all pending reservations for caller on the booking', async () => {
    const t = makeT()
    let bookingId: any
    let resId: any

    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.instructor, slug: TEST_SLUGS.instructor, role: 'Instructor' })
      bookingId = await seedBooking(ctx)
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      resId = await seedReservation(ctx, bookingId, unitId, sessionId)
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId })

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId) as Doc<'reservations'> | null
      expect(res!.status).toBe('Confirmed')
      expect(res!.confirmedAt).toBeTruthy()
    })
  })

  it('only confirms PendingAcceptance (skips already Confirmed)', async () => {
    const t = makeT()
    let bookingId: any
    let pendingResId: any

    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.instructor, slug: TEST_SLUGS.instructor, role: 'Instructor' })
      bookingId = await seedBooking(ctx)
      const unitId = await seedInventoryUnit(ctx)
      const session1 = await seedSession(ctx, bookingId, unitId)
      const session2 = await seedSession(ctx, bookingId, unitId, { date: undefined })
      // One already confirmed, one pending
      await seedReservation(ctx, bookingId, unitId, session1, { status: 'Confirmed' })
      pendingResId = await seedReservation(ctx, bookingId, unitId, session2)
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.instructor })
      .mutation(api.reservationsMutations.acceptByBookingForCaller, { bookingId })

    await t.run(async (ctx) => {
      const pending = await ctx.db.get(pendingResId) as Doc<'reservations'> | null
      expect(pending!.status).toBe('Confirmed')
    })
  })
})
