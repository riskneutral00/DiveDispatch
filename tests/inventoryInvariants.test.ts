/**
 * H3: Inventory Invariants — Explicit
 *
 * Tests the three non-negotiable invariants from CLAUDE.md:
 *   1. No Exclusive-unit inventory held by more than one booking for overlapping window.
 *   2. Pooled inventory decrements on hold; blocks only when count reaches zero.
 *   3. All AvailabilitySnapshot updates occur in the same Convex mutation as the Reservation write.
 *
 * Plus: full-day blocking and lazy snapshot creation.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { isFullDayResource } from '../convex/bookings/_shared'
import { testDate } from './helpers/dates'
import { makeT, expectConvexError } from './helpers/convex-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDCUser() {
  return {
    tokenIdentifier: 'clerk|dc-inv',
    slug: 'dc-inv',
    email: 'dc-inv@test.com',
    name: 'DC Invariant',
    firstName: 'DC',
    lastName: 'Inv',
    businessName: 'Invariant DC',
    isSeeded: false,
    appLanguage: 'en',
  }
}

function makeBooking(ownerId: string, overrides: Partial<WithoutSystemFields<Doc<'bookings'>>> = {}): WithoutSystemFields<Doc<'bookings'>> {
  return {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    ...overrides,
  } as WithoutSystemFields<Doc<'bookings'>>
}

// ─── Invariant 1: Exclusive double-hold ──────────────────────────────────────

describe('Invariant 1 — Exclusive unit double-hold prevention', () => {
  it('H3-1: second booking on same exclusive instructor + overlapping window throws CONFLICT', async () => {
    const t = makeT()

    const { bookingId1, bookingId2, unitId, snapshotId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeDCUser())
      const bookingId1 = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const bookingId2 = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-excl',
        displayName: 'Exclusive Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-excl',
        ownerType: 'Instructor',
      })
      return { bookingId1, bookingId2, unitId, snapshotId: null }
    })

    // First booking succeeds (lazy snapshot creation)
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: bookingId1,
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
      },
    )

    // Second booking on same unit + window → CONFLICT
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
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
        },
      ),
      'CONFLICT',
    )

    // Snapshot must show availableUnits: 0 (never -1)
    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snap = snapshots.find(
        (s) => s.inventoryUnitId === unitId && s.date === testDate(5),
      )
      expect(snap!.availableUnits).toBe(0)
      expect(snap!.reservedUnits).toBe(1)
    })
  })
})

// ─── Invariant 1b: Exclusive rejects unitsRequested > 1 ──────────────────────

describe('Invariant 1b — Exclusive unit rejects unitsRequested > 1', () => {
  it('H3-1b: Exclusive unit with unitsRequested=2 throws INVALID_INPUT', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeDCUser())
      const bookingId = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-excl-guard',
        displayName: 'Exclusive Guard Test',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-excl-guard',
        ownerType: 'Instructor',
      })
      return { bookingId, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 2,
            },
          ],
        },
      ),
      'INVALID_INPUT',
    )
  })
})

// ─── Invariant 2: Pooled at zero + partial ──────────────────────────────────

describe('Invariant 2 — Pooled inventory zero-blocking', () => {
  it('H3-2: boat with 5 seats — five 1-seat bookings succeed, sixth throws CONFLICT', async () => {
    const t = makeT()

    const { bookingIds, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeDCUser())
      const bookingIds = []
      for (let i = 0; i < 6; i++) {
        bookingIds.push(await ctx.db.insert('bookings', makeBooking('dc-inv')))
      }
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-pool-5',
        displayName: 'Boat 5-seat',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: 'boat-pool-5',
        ownerType: 'Boat',
      })
      return { bookingIds, unitId }
    })

    // First 5 bookings each take 1 seat
    for (let i = 0; i < 5; i++) {
      await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingIds[i],
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
        },
      )
    }

    // Sixth booking → CONFLICT
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingIds[5],
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
        },
      ),
      'CONFLICT',
    )

    // Snapshot: availableUnits: 0, reservedUnits: 5
    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snap = snapshots.find(
        (s) => s.inventoryUnitId === unitId && s.date === testDate(5),
      )
      expect(snap!.availableUnits).toBe(0)
      expect(snap!.reservedUnits).toBe(5)
    })
  })

  it('H3-3: pooled partial — request 3 of 5 succeeds, second request for 3 throws CONFLICT', async () => {
    const t = makeT()

    const { bookingId1, bookingId2, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeDCUser())
      const bookingId1 = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const bookingId2 = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-partial',
        displayName: 'Boat 5-seat partial',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: 'boat-partial',
        ownerType: 'Boat',
      })
      return { bookingId1, bookingId2, unitId }
    })

    // First booking: 3 seats
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: bookingId1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 3,
          },
        ],
      },
    )

    // Assert: availableUnits: 2
    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const snap = snapshots.find(
        (s) => s.inventoryUnitId === unitId && s.date === testDate(5),
      )
      expect(snap!.availableUnits).toBe(2)
      expect(snap!.reservedUnits).toBe(3)
    })

    // Second booking: request 3 more → only 2 available → CONFLICT
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 3,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })
})

// ─── Invariant 3: Atomicity — zero writes after CONFLICT ────────────────────

describe('Invariant 3 — Atomicity on CONFLICT', () => {
  it('H3-4: after CONFLICT throw, zero writes (no reservation, no snapshot change, no session)', async () => {
    const t = makeT()

    const { bookingId, unitId, snapshotId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeDCUser())
      const bookingId = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-atom',
        displayName: 'Instructor Atomicity',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-atom',
        ownerType: 'Instructor',
      })
      // Pre-existing snapshot — already fully held by another booking
      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId, unitId, snapshotId }
    })

    // Record state before the failed mutation
    const [reservationCountBefore, sessionCountBefore, snapshotBefore] = await t.run(
      async (ctx) => {
        const reservations = await ctx.db.query('reservations').collect()
        const sessions = await ctx.db.query('bookingSessions').collect()
        const snapshot = await ctx.db.get(snapshotId)
        return [reservations.length, sessions.length, snapshot]
      },
    )

    // Attempt booking → CONFLICT
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
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
        },
      ),
      'CONFLICT',
    )

    // Assert zero writes occurred
    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations.length).toBe(reservationCountBefore)

      const sessions = await ctx.db.query('bookingSessions').collect()
      expect(sessions.length).toBe(sessionCountBefore)

      const snapshot = await ctx.db.get(snapshotId)
      expect(snapshot!.availableUnits).toBe(snapshotBefore!.availableUnits)
      expect(snapshot!.reservedUnits).toBe(snapshotBefore!.reservedUnits)
    })
  })
})

// ─── Full-day blocking ──────────────────────────────────────────────────────

describe('Full-day blocking — day boat', () => {
  it('H3-5: day boat booked for morning — afternoon booking on same date throws CONFLICT', async () => {
    const t = makeT()

    const { bookingId1, bookingId2, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeDCUser())
      const bookingId1 = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const bookingId2 = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'day-boat-full',
        displayName: 'Day Boat Full',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: 'day-boat-full',
        ownerType: 'Boat',
        boatType: 'day_boat',
      })
      return { bookingId1, bookingId2, unitId }
    })

    // Verify isFullDayResource sees this as a full-day resource
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'day_boat' })).toBe(true)

    // Morning booking succeeds
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: bookingId1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '12:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 5,
          },
        ],
      },
    )

    // Afternoon booking on same date → CONFLICT (full-day blocks entire date)
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '13:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })
})

// ─── Lazy snapshot creation ─────────────────────────────────────────────────

describe('Lazy snapshot creation', () => {
  it('H3-6: first booking on unit with no pre-existing snapshot creates one correctly', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeDCUser())
      const bookingId = await ctx.db.insert('bookings', makeBooking('dc-inv'))
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-lazy',
        displayName: 'Boat Lazy Snap',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: 'boat-lazy',
        ownerType: 'Boat',
      })
      return { bookingId, unitId }
    })

    // No pre-existing snapshot — verify
    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(0)
    })

    // Book 1 seat
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-inv' }).mutation(
      api.bookings.create.submitToDraft,
      {
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
      },
    )

    // Snapshot created with correct values
    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].availableUnits).toBe(4) // 5 total - 1 requested
      expect(snapshots[0].reservedUnits).toBe(1)
      expect(snapshots[0].totalUnits).toBe(5)
    })
  })
})
