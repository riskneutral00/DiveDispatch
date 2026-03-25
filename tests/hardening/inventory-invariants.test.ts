import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { testDate } from '../helpers/dates'
import { makeT, expectConvexError } from '../helpers/convex-helpers'
import {
  seedUser as _seedUser,
  seedBooking as _seedBooking,
  seedInventoryUnit,
  type SeedCtx,
} from '../fixtures'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedUser(ctx: SeedCtx, slug: string, role: Parameters<typeof _seedUser>[1]['role'] = 'DiveCenter') {
  await _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: `${slug} Display`, firstName: slug, lastName: 'Test', role })
}

async function seedBooking(ctx: SeedCtx, ownerId: string, overrides: Record<string, unknown> = {}) {
  return _seedBooking(ctx, {
    ownerId,
    startDate: testDate(5),
    endDate: testDate(7),
    bookingFormComplete: false,
    ...overrides,
  })
}

async function seedExclusiveInstructor(ctx: SeedCtx, ownerSlug: string = 'instructor-1') {
  return seedInventoryUnit(ctx, {
    resourceType: 'Instructor',
    displayName: 'Instructor One',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId: ownerSlug,
    ownerType: 'Instructor',
  })
}

async function seedBoat(
  ctx: SeedCtx,
  opts: {
    ownerSlug?: string
    totalUnits?: number
    boatType?: 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib'
    capacityModel?: 'Exclusive' | 'Pooled'
  } = {},
) {
  const {
    ownerSlug = 'boat-owner',
    totalUnits = 3,
    boatType = 'speedboat',
    capacityModel = 'Pooled',
  } = opts
  return seedInventoryUnit(ctx, {
    resourceType: 'Boat',
    displayName: 'MV Test Boat',
    capacityModel,
    totalUnits,
    ownerId: ownerSlug,
    ownerType: 'Boat',
    boatType,
  })
}

// ─── L9-01: Exclusive Unit — No Double Hold ──────────────────────────────────

describe('L9-01: Exclusive Unit — No Double Hold', () => {
  it('second booking for same instructor+window throws CONFLICT', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingA, bookingB, unitId }
    })

    // Booking A succeeds
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
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

    // Booking B — same instructor, same window — must throw CONFLICT
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookingB,
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
        }),
      'CONFLICT',
    )

    // Verify snapshot unchanged — still shows Booking A's hold
    const snapshot = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.availableUnits).toBe(0)
    expect(snapshot!.reservedUnits).toBe(1)

    // Verify zero reservation rows for Booking B
    const bookingBReservations = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingB))
        .collect()
      return all
    })
    expect(bookingBReservations).toHaveLength(0)
  })

  it('same instructor, non-overlapping windows — both succeed', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingA, bookingB, unitId }
    })

    // Morning window
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
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

    // Afternoon window — different time, should succeed
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingB,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '13:00',
            endTime: '15:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    // Both bookings should have reservations
    const [resA, resB] = await t.run(async (ctx) => {
      const a = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingA))
        .collect()
      const b = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingB))
        .collect()
      return [a, b]
    })
    expect(resA).toHaveLength(1)
    expect(resB).toHaveLength(1)
  })

  it('same instructor, different dates — both succeed', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingA, bookingB, unitId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
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

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingB,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(6),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    const [resA, resB] = await t.run(async (ctx) => {
      const a = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingA))
        .collect()
      const b = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingB))
        .collect()
      return [a, b]
    })
    expect(resA).toHaveLength(1)
    expect(resB).toHaveLength(1)
  })
})

// ─── L9-02: Shared-Capacity Unit — Block at Zero ────────────────────────────

describe('L9-02: Shared-Capacity Unit — Block at Zero (Backend)', () => {
  it('4th booking rejected when pool of 3 is fully held', async () => {
    const t = makeT()

    const { bookings, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const b1 = await seedBooking(ctx, 'dc-test')
      const b2 = await seedBooking(ctx, 'dc-test')
      const b3 = await seedBooking(ctx, 'dc-test')
      const b4 = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx)
      return { bookings: [b1, b2, b3, b4], unitId }
    })

    const session = {
      inventoryUnitId: unitId,
      date: testDate(5),
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
      unitsRequested: 1,
    }

    // Bookings 1–3 each hold 1 of 3 units → all succeed
    for (let i = 0; i < 3; i++) {
      await t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookings[i],
          sessions: [session],
        })
    }

    // Booking 4 — capacity exhausted → CONFLICT
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookings[3],
          sessions: [session],
        }),
      'CONFLICT',
    )

    // Verify snapshot: 0 available, 3 reserved
    const snapshot = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.availableUnits).toBe(0)
    expect(snapshot!.reservedUnits).toBe(3)

    // Verify booking 4 has zero reservations
    const b4Reservations = await t.run(async (ctx) => {
      return ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookings[3]))
        .collect()
    })
    expect(b4Reservations).toHaveLength(0)
  })

  it('partial hold rejected when requested exceeds remaining capacity', async () => {
    const t = makeT()

    const { b1, b2, b3, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const b1 = await seedBooking(ctx, 'dc-test')
      const b2 = await seedBooking(ctx, 'dc-test')
      const b3 = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx)
      return { b1, b2, b3, unitId }
    })

    const makeSession = (units: number) => ({
      inventoryUnitId: unitId,
      date: testDate(5),
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
      unitsRequested: units,
    })

    // Hold 1 + 1 = 2 used, 1 remaining
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: b1,
        sessions: [makeSession(1)],
      })
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: b2,
        sessions: [makeSession(1)],
      })

    // Request 2 units but only 1 left → CONFLICT
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: b3,
          sessions: [makeSession(2)],
        }),
      'CONFLICT',
    )
  })

  it('bookings within total capacity all succeed', async () => {
    const t = makeT()

    const { b1, b2, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const b1 = await seedBooking(ctx, 'dc-test')
      const b2 = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx)
      return { b1, b2, unitId }
    })

    const makeSession = (units: number) => ({
      inventoryUnitId: unitId,
      date: testDate(5),
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
      unitsRequested: units,
    })

    // 2 + 1 = 3 total, exactly at capacity
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: b1,
        sessions: [makeSession(2)],
      })
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: b2,
        sessions: [makeSession(1)],
      })

    // Snapshot: 0 available, 3 reserved
    const snapshot = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.availableUnits).toBe(0)
    expect(snapshot!.reservedUnits).toBe(3)

    // Both bookings have reservations
    const [resA, resB] = await t.run(async (ctx) => {
      const a = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', b1))
        .collect()
      const b = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', b2))
        .collect()
      return [a, b]
    })
    expect(resA).toHaveLength(1)
    expect(resB).toHaveLength(1)
  })
})

// ─── L9-02: Shared-Capacity — Frontend Query Layer ──────────────────────────

describe('L9-02: Frontend — getUnavailableUnitIdsForDates', () => {
  it('returns unit ID when shared-capacity is fully booked', async () => {
    const t = makeT()

    const { bookings, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const b1 = await seedBooking(ctx, 'dc-test')
      const b2 = await seedBooking(ctx, 'dc-test')
      const b3 = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx)
      return { bookings: [b1, b2, b3], unitId }
    })

    const session = {
      inventoryUnitId: unitId,
      date: testDate(5),
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
      unitsRequested: 1,
    }

    // Fill all 3 units
    for (let i = 0; i < 3; i++) {
      await t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookings[i],
          sessions: [session],
        })
    }

    // Query should return this unit as unavailable
    const unavailable = await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).query(api.availability.getUnavailableUnitIdsForDates, {
      dates: [testDate(5)],
    })
    expect(unavailable).toContain(unitId)
  })

  it('does NOT return unit ID when capacity remains', async () => {
    const t = makeT()

    const { b1, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const b1 = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx)
      return { b1, unitId }
    })

    // Only 1 of 3 units held — capacity remains
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: b1,
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

    const unavailable = await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).query(api.availability.getUnavailableUnitIdsForDates, {
      dates: [testDate(5)],
    })
    expect(unavailable).not.toContain(unitId)
  })

  it('only flags the fully-booked date, not other dates', async () => {
    const t = makeT()

    const { bookings, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const b1 = await seedBooking(ctx, 'dc-test')
      const b2 = await seedBooking(ctx, 'dc-test')
      const b3 = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx)
      return { bookings: [b1, b2, b3], unitId }
    })

    // Fill June 15 only
    for (let i = 0; i < 3; i++) {
      await t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookings[i],
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
    }

    // June 15 → unavailable
    const unavailableJune15 = await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).query(api.availability.getUnavailableUnitIdsForDates, {
      dates: [testDate(5)],
    })
    expect(unavailableJune15).toContain(unitId)

    // June 16 → still available (no bookings)
    const unavailableJune16 = await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).query(api.availability.getUnavailableUnitIdsForDates, {
      dates: [testDate(6)],
    })
    expect(unavailableJune16).not.toContain(unitId)
  })
})

// ─── L9-03: Snapshot Atomicity ──────────────────────────────────────────────

describe('L9-03: Snapshot Atomicity', () => {
  it('successful hold creates both reservation and snapshot', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const bookingId = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingId, unitId }
    })

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

    const { reservation, snapshot } = await t.run(async (ctx) => {
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingId))
        .collect()
      const snapshot = await ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
      return { reservation: reservations[0], snapshot }
    })

    // Both must exist — reservation from array index, snapshot from .unique()
    expect(reservation).toEqual(expect.objectContaining({ inventoryUnitId: unitId }))
    expect(snapshot).not.toBeNull()

    // And they agree on the unit
    expect(snapshot!.inventoryUnitId).toBe(unitId)
    expect(snapshot!.reservedUnits).toBe(1)
    expect(snapshot!.availableUnits).toBe(0)
  })

  it('failed hold creates neither reservation nor snapshot', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingA, bookingB, unitId }
    })

    const session = {
      inventoryUnitId: unitId,
      date: testDate(5),
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
      unitsRequested: 1,
    }

    // A takes the slot
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
        sessions: [session],
      })

    // Capture snapshot state after A
    const snapshotAfterA = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })

    // B fails — CONFLICT
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookingB,
          sessions: [session],
        }),
      'CONFLICT',
    )

    // Zero reservations for B
    const bReservations = await t.run(async (ctx) => {
      return ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingB))
        .collect()
    })
    expect(bReservations).toHaveLength(0)

    // Snapshot unchanged from after A
    const snapshotAfterB = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(snapshotAfterB!.availableUnits).toBe(snapshotAfterA!.availableUnits)
    expect(snapshotAfterB!.reservedUnits).toBe(snapshotAfterA!.reservedUnits)
  })

  it('cancel restores both reservation status and snapshot units', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      const bookingId = await seedBooking(ctx, 'dc-test')
      const unitId = await seedExclusiveInstructor(ctx)
      return { bookingId, unitId }
    })

    // Hold the resource
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

    // Snapshot before cancel: 0 available, 1 reserved
    const before = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(before!.availableUnits).toBe(0)
    expect(before!.reservedUnits).toBe(1)

    // Cancel the booking
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    // Reservation is Vacated
    const reservations = await t.run(async (ctx) => {
      return ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingId))
        .collect()
    })
    expect(reservations).toHaveLength(1)
    expect(reservations[0].status).toBe('Vacated')
    expect(reservations[0].vacatedBy).toBe('booking_cancelled')

    // Snapshot restored: 1 available, 0 reserved
    const after = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(after!.availableUnits).toBe(1)
    expect(after!.reservedUnits).toBe(0)
  })
})

// ─── L9-03b: Snapshot Atomicity — Chaos ─────────────────────────────────────

describe('L9-03b: Snapshot Atomicity -- Chaos', () => {
  it('multi-session conflict rollback — second session conflicts, entire mutation rolled back', async () => {
    const t = makeT()

    const { bookingA, bookingB, instructorId, instructor2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedUser(ctx, 'instructor-2', 'Instructor')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const instructorId = await seedExclusiveInstructor(ctx)
      const instructor2Id = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Instructor Two',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-2',
        ownerType: 'Instructor',
      })
      return { bookingA, bookingB, instructorId, instructor2Id }
    })

    // Booking A takes instructor-2 for morning session
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
        sessions: [
          {
            inventoryUnitId: instructor2Id,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    // Capture snapshot state before B's attempt
    const snapshotInstr1Before = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', instructorId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })

    // Booking B requests 2 sessions: instructor-1 (free) + instructor-2 (taken)
    // Session 1 would succeed alone, but session 2 conflicts → entire mutation must roll back
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookingB,
          sessions: [
            {
              inventoryUnitId: instructorId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
            {
              inventoryUnitId: instructor2Id,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        }),
      'CONFLICT',
    )

    // Verify: NO reservation created for booking B (neither session)
    const bReservations = await t.run(async (ctx) => {
      return ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingB))
        .collect()
    })
    expect(bReservations).toHaveLength(0)

    // Verify: instructor-1 snapshot was NOT decremented (rollback)
    const snapshotInstr1After = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', instructorId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    // Before B's attempt, no snapshot existed for instructor-1 → should still be null
    expect(snapshotInstr1After).toEqual(snapshotInstr1Before)
  })

  it('successful multi-session atomicity — both reservations AND both snapshots exist', async () => {
    const t = makeT()

    const { bookingId, instructorId, instructor2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'instructor-1', 'Instructor')
      await seedUser(ctx, 'instructor-2', 'Instructor')
      const bookingId = await seedBooking(ctx, 'dc-test')
      const instructorId = await seedExclusiveInstructor(ctx)
      const instructor2Id = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Instructor Two',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-2',
        ownerType: 'Instructor',
      })
      return { bookingId, instructorId, instructor2Id }
    })

    // Submit with 2 sessions — both should succeed atomically
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId,
        sessions: [
          {
            inventoryUnitId: instructorId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
          {
            inventoryUnitId: instructor2Id,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    // Verify both reservations exist
    const reservations = await t.run(async (ctx) => {
      return ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingId))
        .collect()
    })
    expect(reservations).toHaveLength(2)
    const reservedUnitIds = reservations.map((r: { inventoryUnitId: string }) => r.inventoryUnitId)
    expect(reservedUnitIds).toContain(instructorId)
    expect(reservedUnitIds).toContain(instructor2Id)

    // Verify both snapshots exist and are correctly decremented
    const [snap1, snap2] = await t.run(async (ctx) => {
      const s1 = await ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', instructorId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
      const s2 = await ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', instructor2Id).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
      return [s1, s2]
    })
    expect(snap1).not.toBeNull()
    expect(snap2).not.toBeNull()
    expect(snap1!.reservedUnits).toBe(1)
    expect(snap1!.availableUnits).toBe(0)
    expect(snap2!.reservedUnits).toBe(1)
    expect(snap2!.availableUnits).toBe(0)
  })

  it('pooled capacity orphan check — fill to capacity, attempt one more, verify zero orphans', async () => {
    const t = makeT()

    const { bookings, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const b1 = await seedBooking(ctx, 'dc-test')
      const b2 = await seedBooking(ctx, 'dc-test')
      const b3 = await seedBooking(ctx, 'dc-test')
      const b4 = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx) // 3 units pooled
      return { bookings: [b1, b2, b3, b4], unitId }
    })

    const session = {
      inventoryUnitId: unitId,
      date: testDate(5),
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Bangkok',
      unitsRequested: 1,
    }

    // Fill all 3 slots
    for (let i = 0; i < 3; i++) {
      await t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookings[i],
          sessions: [session],
        })
    }

    // Capture snapshot state at capacity
    const snapshotAtCapacity = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(snapshotAtCapacity!.availableUnits).toBe(0)
    expect(snapshotAtCapacity!.reservedUnits).toBe(3)

    // 4th booking — must fail
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookings[3],
          sessions: [session],
        }),
      'CONFLICT',
    )

    // Verify zero orphan reservations for booking 4
    const b4Reservations = await t.run(async (ctx) => {
      return ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookings[3]))
        .collect()
    })
    expect(b4Reservations).toHaveLength(0)

    // Verify snapshot unchanged — no phantom decrement
    const snapshotAfterReject = await t.run(async (ctx) => {
      return ctx.db
        .query('availabilitySnapshots')
        .withIndex('by_inventoryUnitId_date_windowStart', (q: any) =>
          q.eq('inventoryUnitId', unitId).eq('date', testDate(5)).eq('windowStart', '09:00'),
        )
        .unique()
    })
    expect(snapshotAfterReject!.availableUnits).toBe(snapshotAtCapacity!.availableUnits)
    expect(snapshotAfterReject!.reservedUnits).toBe(snapshotAtCapacity!.reservedUnits)

    // Count total reservations across all 4 bookings — exactly 3 (one per successful booking, zero orphans)
    const reservationCounts = await t.run(async (ctx) => {
      const counts = []
      for (const bId of bookings) {
        const res = await ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bId))
          .collect()
        counts.push(res.length)
      }
      return counts
    })
    // Bookings 1-3: 1 reservation each. Booking 4: 0 (no orphan)
    expect(reservationCounts).toEqual([1, 1, 1, 0])
  })
})

// ─── L9-04: Full-Day Resource Blocking ──────────────────────────────────────

describe('L9-04: Full-Day Resource Blocking', () => {
  it('day boat — morning hold blocks afternoon on same date', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx, { boatType: 'day_boat', totalUnits: 1, capacityModel: 'Exclusive' })
      return { bookingA, bookingB, unitId }
    })

    // Morning hold
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
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

    // Afternoon — different window, same date → CONFLICT (full-day block)
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookingB,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '13:00',
              endTime: '15:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        }),
      'CONFLICT',
    )
  })

  it('speedboat — morning hold does NOT block afternoon', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx, { boatType: 'speedboat', totalUnits: 1, capacityModel: 'Exclusive' })
      return { bookingA, bookingB, unitId }
    })

    // Morning
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
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

    // Afternoon — different window → succeeds (speedboat is per-window)
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingB,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '13:00',
            endTime: '15:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    // Both have reservations
    const [resA, resB] = await t.run(async (ctx) => {
      const a = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingA))
        .collect()
      const b = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingB))
        .collect()
      return [a, b]
    })
    expect(resA).toHaveLength(1)
    expect(resB).toHaveLength(1)
  })

  it('liveaboard — any hold blocks entire date', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx, { boatType: 'liveaboard', totalUnits: 1, capacityModel: 'Exclusive' })
      return { bookingA, bookingB, unitId }
    })

    // Hold any window
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
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

    // Different window, same date → CONFLICT (liveaboard = full-day)
    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .mutation(api.bookings.create.submitToDraft, {
          bookingId: bookingB,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '14:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        }),
      'CONFLICT',
    )
  })

  it('day boat — different date still available', async () => {
    const t = makeT()

    const { bookingA, bookingB, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-test')
      await seedUser(ctx, 'boat-owner', 'Boat')
      const bookingA = await seedBooking(ctx, 'dc-test')
      const bookingB = await seedBooking(ctx, 'dc-test')
      const unitId = await seedBoat(ctx, { boatType: 'day_boat', totalUnits: 1, capacityModel: 'Exclusive' })
      return { bookingA, bookingB, unitId }
    })

    // June 15
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingA,
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

    // June 16 — different date → succeeds
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .mutation(api.bookings.create.submitToDraft, {
        bookingId: bookingB,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(6),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      })

    const [resA, resB] = await t.run(async (ctx) => {
      const a = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingA))
        .collect()
      const b = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingB))
        .collect()
      return [a, b]
    })
    expect(resA).toHaveLength(1)
    expect(resB).toHaveLength(1)
  })
})
