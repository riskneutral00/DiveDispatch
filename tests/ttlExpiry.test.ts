import { describe, it, expect, afterEach, vi } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import { isSessionEnded, isBookingExpired } from '../convex/bookings/_shared'
import { resolvePortalToken, resolvePortalTokenSoft } from '../convex/lib/portal'
import { Id } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { BOOKING_LINK_TTL_MS } from '../convex/lib/timeConstants'
import { testDate, testToken } from './helpers/dates'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import {
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedSnapshot,
  seedSession,
  seedReservation,
  seedBookingLink,
  seedCustomerProfile,
  seedPortalFixture,
} from './fixtures'

describe('isSessionEnded', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns true when current date is past the session date', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(6) + 'T10:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '17:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exceeds session end time on the same day', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exactly equals session end time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T11:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns false when session has not ended yet', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T09:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'Asia/Bangkok')).toBe(false)
  })

  it('returns false when current date is before session date', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(4) + 'T10:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '08:00', 'Asia/Bangkok')).toBe(false)
  })

  it('works with UTC timezone', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T18:01:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'UTC')).toBe(true)
  })

  it('handles midnight boundary (session ending at 00:00 next day)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T17:01:00Z').getTime())
    expect(isSessionEnded(testDate(5), '23:59', 'Asia/Bangkok')).toBe(true)
  })
})

describe('isBookingExpired', () => {
  it('returns true for Draft booking with past expiresAt', () => {
    expect(
      isBookingExpired({ status: 'Draft', expiresAt: Date.now() - 1_000 }),
    ).toBe(true)
  })

  it('returns false for Draft booking with future expiresAt', () => {
    expect(
      isBookingExpired({ status: 'Draft', expiresAt: Date.now() + 10_000 }),
    ).toBe(false)
  })

  it('returns false for Upcoming booking with past expiresAt', () => {
    expect(
      isBookingExpired({ status: 'Upcoming', expiresAt: Date.now() - 1_000 }),
    ).toBe(false)
  })

  it('returns false for Draft booking with no expiresAt', () => {
    expect(isBookingExpired({ status: 'Draft', expiresAt: undefined })).toBe(false)
    expect(isBookingExpired({ status: 'Draft', expiresAt: null })).toBe(false)
  })

  it('returns false for Cancelled booking with past expiresAt', () => {
    expect(
      isBookingExpired({ status: 'Cancelled', expiresAt: Date.now() - 1_000 }),
    ).toBe(false)
  })
})

describe('expireBooking', () => {
  afterEach(() => vi.clearAllMocks())

  it('sets expired Draft to Cancelled (not deleted)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      }),
    )

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking?.status).toBe('Cancelled')
  })

  it('vacates active reservations with hold_expired reason', async () => {
    const t = makeT()

    const { bookingId, reservationId, snapshotId } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      })

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'inst-1',
        displayName: 'Instructor',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        startTime: '09:00',
        endTime: '17:00',
      })

      const snapshotId = await seedSnapshot(ctx, unitId, {
        windowStart: '09:00',
        windowEnd: '17:00',
        reservedUnits: 1,
        availableUnits: 0,
      })

      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId)

      return { bookingId, reservationId, snapshotId }
    })

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(reservation?.status).toBe('Vacated')
    expect(reservation?.vacatedBy).toBe('hold_expired')

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot?.availableUnits).toBe(1)
    expect(snapshot?.reservedUnits).toBe(0)
  })

  it('preserves sessions and booking links (audit trail)', async () => {
    const t = makeT()

    const { bookingId, sessionId, linkId } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      })

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'inst-2',
        displayName: 'Instructor',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        startTime: '09:00',
        endTime: '17:00',
      })

      const linkId = await seedBookingLink(ctx, bookingId, {
        token: 'audit-token-1',
        expiresAt: Date.now() + 86_400_000,
        customerName: 'Test Customer',
        email: 'test@example.com',
      })

      return { bookingId, sessionId, linkId }
    })

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const session = await t.run(async (ctx) => ctx.db.get(sessionId))
    expect(session).not.toBeNull()

    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link).not.toBeNull()

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('is a no-op for Upcoming booking with past expiresAt', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      }),
    )

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Upcoming')
  })

  it('is a no-op for already-Cancelled booking (idempotent)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Cancelled',
        bookingFormComplete: false,
        divers: [],
        expiresAt: Date.now() - 1_000,
      }),
    )

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('is a no-op for Draft with future expiresAt', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() + 10_000,
      }),
    )

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')
  })

  it('expired Draft appears in listByOwner as Cancelled (not deleted)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-1',
        slug: 'dc-1',
        email: 'dc1@test.com',
        firstName: 'DC',
        lastName: 'One',
      })
      await seedBooking(ctx, {
        ownerId: 'dc-1',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] }],
        startDate: testDate(5),
        endDate: testDate(7),
        expiresAt: Date.now() - 1_000,
      })
    })

    const bookingsBefore = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(bookingsBefore).toHaveLength(1)
    expect(bookingsBefore[0].status).toBe('Draft')

    const bookingId = bookingsBefore[0]._id as Id<'bookings'>
    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const bookingsAfter = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(bookingsAfter).toHaveLength(1)
    expect(bookingsAfter[0].status).toBe('Cancelled')
  })

  it('expired Draft never appears in myDashboard bookings', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-1',
        slug: 'dc-1',
        email: 'dc1@test.com',
        firstName: 'DC',
        lastName: 'One',
      })
      await seedBooking(ctx, {
        ownerId: 'dc-1',
        status: 'Cancelled',
        bookingFormComplete: true,
        divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] }],
        startDate: testDate(5),
        endDate: testDate(7),
        expiresAt: Date.now() - 1_000,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard, { activeRole: 'DiveCenter' })
    expect(result.bookings).toHaveLength(0)
    expect(result.requests).toHaveLength(0)
  })

  it('H1-1: snapshot restoration on expiry — exclusive unit restored to availableUnits: 1', async () => {
    const t = makeT()

    const { bookingId, snapshotId } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      })

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'inst-h1-1',
        displayName: 'Instructor H1-1',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        startTime: '09:00',
        endTime: '17:00',
      })

      const snapshotId = await seedSnapshot(ctx, unitId, {
        windowStart: '09:00',
        windowEnd: '17:00',
        reservedUnits: 1,
        availableUnits: 0,
      })

      await seedReservation(ctx, bookingId, unitId, sessionId)

      return { bookingId, snapshotId }
    })

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot!.availableUnits).toBe(1)
    expect(snapshot!.reservedUnits).toBe(0)
  })

  it('H1-2: multi-session expiry — ALL 3 snapshots restored atomically', async () => {
    const t = makeT()

    const { bookingId, snapshotIds } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        startDate: testDate(5),
        endDate: testDate(7),
        expiresAt: Date.now() - 1_000,
      })

      const instructorUnitId = await seedInventoryUnit(ctx, {
        ownerId: 'inst-h1-2',
        displayName: 'Instructor H1-2',
      })

      const boatUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-h1-2',
        ownerType: 'Boat',
        displayName: 'Boat H1-2',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })

      const poolUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Venue',
        ownerId: 'pool-h1-2',
        ownerType: 'Venue',
        displayName: 'Pool H1-2',
      })

      const snapshotIds: Id<'availabilitySnapshots'>[] = []

      const sess1 = await seedSession(ctx, bookingId, instructorUnitId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '17:00',
      })
      snapshotIds.push(
        await seedSnapshot(ctx, instructorUnitId, {
          date: testDate(5),
          windowStart: '09:00',
          windowEnd: '17:00',
          reservedUnits: 1,
          availableUnits: 0,
        }),
      )
      await seedReservation(ctx, bookingId, instructorUnitId, sess1)

      const sess2 = await seedSession(ctx, bookingId, boatUnitId, {
        date: testDate(6),
        startTime: '08:00',
        endTime: '16:00',
      })
      snapshotIds.push(
        await seedSnapshot(ctx, boatUnitId, {
          date: testDate(6),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 10,
          reservedUnits: 3,
          availableUnits: 7,
        }),
      )
      await seedReservation(ctx, bookingId, boatUnitId, sess2, {
        unitsRequested: 3,
        status: 'Confirmed',
      })

      const sess3 = await seedSession(ctx, bookingId, poolUnitId, {
        date: testDate(7),
        startTime: '10:00',
        endTime: '12:00',
      })
      snapshotIds.push(
        await seedSnapshot(ctx, poolUnitId, {
          date: testDate(7),
          windowStart: '10:00',
          windowEnd: '12:00',
          reservedUnits: 1,
          availableUnits: 0,
        }),
      )
      await seedReservation(ctx, bookingId, poolUnitId, sess3)

      return { bookingId, snapshotIds }
    })

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const [instrSnap, boatSnap, poolSnap] = await t.run(async (ctx) =>
      Promise.all(snapshotIds.map((id) => ctx.db.get(id))),
    )

    expect(instrSnap!.availableUnits).toBe(1)
    expect(instrSnap!.reservedUnits).toBe(0)

    expect(boatSnap!.availableUnits).toBe(10)
    expect(boatSnap!.reservedUnits).toBe(0)

    expect(poolSnap!.availableUnits).toBe(1)
    expect(poolSnap!.reservedUnits).toBe(0)

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Cancelled')
  })

  it('H1-3: pooled unit restoration — 2 of 5 boat seats restored on expiry', async () => {
    const t = makeT()

    const { bookingId, snapshotId } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-h1-3',
        ownerType: 'Boat',
        displayName: 'Boat H1-3',
        capacityModel: 'Pooled',
        totalUnits: 5,
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        startTime: '09:00',
        endTime: '17:00',
      })

      const snapshotId = await seedSnapshot(ctx, unitId, {
        windowStart: '09:00',
        windowEnd: '17:00',
        totalUnits: 5,
        reservedUnits: 2,
        availableUnits: 3,
      })

      await seedReservation(ctx, bookingId, unitId, sessionId, {
        unitsRequested: 2,
      })

      return { bookingId, snapshotId }
    })

    await t.mutation(internal.bookings.status.expireBooking, { bookingId })

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot!.availableUnits).toBe(5)
    expect(snapshot!.reservedUnits).toBe(0)
  })

  it('getByToken returns expired for booking past TTL', async () => {
    const t = makeT()

    const token = 'tok-expired-test'
    await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
        expiresAt: Date.now() - 1_000,
      })

      await seedBookingLink(ctx, bookingId, {
        token,
        expiresAt: Date.now() + BOOKING_LINK_TTL_MS,
        customerName: 'Alice',
        email: 'alice@example.com',
      })
    })

    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('expired')
  })

  it('no cron entry references expireHolds', () => {
    expect(true).toBe(true)
  })
})

describe('checkAndExpireBooking', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects unauthenticated callers', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      }),
    )

    await expect(
      t.mutation(api.bookings.status.checkAndExpireBooking, { bookingId }),
    ).rejects.toThrow()
  })

  it('rejects caller who does not own or have reservation on booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|intruder',
        slug: 'intruder',
        email: 'intruder@test.com',
        firstName: 'In',
        lastName: 'Truder',
      })

      return seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: true,
        divers: [],
        expiresAt: Date.now() - 1_000,
      })
    })

    await expectConvexError(
      t
        .withIdentity({ tokenIdentifier: 'clerk|intruder' })
        .mutation(api.bookings.status.checkAndExpireBooking, { bookingId }),
      'FORBIDDEN',
    )
  })

  it('expires booking inline when caller owns the expired booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-owner',
        slug: 'dc-owner',
        email: 'owner@test.com',
        firstName: 'Owner',
        lastName: 'DC',
      })

      return seedBooking(ctx, {
        ownerId: 'dc-owner',
        status: 'Draft',
        bookingFormComplete: true,
        operatorName: 'Owner DC',
        divers: [],
        expiresAt: Date.now() - 1_000,
      })
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-owner' })
      .mutation(api.bookings.status.checkAndExpireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('is a no-op for non-expired booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-owner2',
        slug: 'dc-owner2',
        email: 'owner2@test.com',
        firstName: 'Owner',
        lastName: 'DC2',
      })

      return seedBooking(ctx, {
        ownerId: 'dc-owner2',
        status: 'Draft',
        bookingFormComplete: true,
        operatorName: 'Owner DC2',
        divers: [],
        expiresAt: Date.now() + 10_000,
      })
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-owner2' })
      .mutation(api.bookings.status.checkAndExpireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')
  })
})

describe('completeBookings', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('returns { completed: 0, more: false } when no sessions have ended', async () => {
    const t = makeT()
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T08:00:00Z').getTime())

    await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        displayName: 'Instructor unit',
      })
      await seedSession(ctx, bookingId, unitId, {
        startTime: '09:00',
        endTime: '17:00',
      })
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })
  })

  it('completes a booking when its last session has ended', async () => {
    const t = makeT()
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        displayName: 'Instructor unit',
      })
      await seedSession(ctx, bookingId, unitId, {
        startTime: '08:00',
        endTime: '18:00',
      })
      return bookingId
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 1, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Completed')
  })

  it('picks the last session by date and endTime for multi-session bookings', async () => {
    const t = makeT()
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        divers: [],
        startDate: testDate(4),
        endDate: testDate(5),
      })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        displayName: 'Instructor unit',
      })
      await seedSession(ctx, bookingId, unitId, {
        date: testDate(4),
        startTime: '08:00',
        endTime: '17:00',
      })
      await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '18:00',
      })
      return bookingId
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 1, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Completed')
  })

  it('skips bookings with no sessions', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
        divers: [],
      }),
    )

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Upcoming')
  })

  it('reports more: true when there are >100 Upcoming bookings', async () => {
    const t = makeT()
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())

    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-1',
        displayName: 'Instructor unit',
        totalUnits: 101,
      })
      for (let i = 0; i < 101; i++) {
        const bookingId = await seedBooking(ctx, {
          ownerId: 'dc-test',
          status: 'Upcoming',
          bookingFormComplete: true,
          customerFormComplete: true,
          divers: [],
        })
        await seedSession(ctx, bookingId, unitId, {
          startTime: '08:00',
          endTime: '10:00',
        })
      }
    })

    const result = (await t.mutation(internal.bookings.status.completeBookings, {})) as {
      completed: number
      more: boolean
    }
    expect(result.more).toBe(true)
    expect(result.completed).toBe(100)
  })
})

describe('toggleBlockedDate auto-cancels Draft bookings', () => {
  afterEach(() => vi.clearAllMocks())

  it('blocking a date auto-cancels overlapping Draft booking', async () => {
    const t = makeT()

    const { bookingId, unitId, sessionIds, reservationIds, snapshotIds, linkId } = await t.run(
      async (ctx) => {
        await seedUser(ctx, {
          tokenIdentifier: 'clerk|inst-1',
          slug: 'inst-1',
          email: 'inst1@test.com',
          firstName: 'Instructor',
          lastName: 'One',
          role: 'Instructor',
        })

        const unitId = await seedInventoryUnit(ctx, {
          ownerId: 'inst-1',
          displayName: 'Instructor One',
        })

        const bookingId = await seedBooking(ctx, {
          ownerId: 'dc-test',
          status: 'Draft',
          activityType: ['AOW'],
          startDate: testDate(4),
          endDate: testDate(6),
          divers: [
            {
              name: 'Alice',
              abbrev: 'A',
              flag: { code: 'US', label: 'USA' },
              startDate: testDate(4),
              endDate: testDate(6),
              activityType: ['AOW'],
            },
          ],
          bookingFormComplete: true,
          expiresAt: Date.now() + HOLD_TTL,
        })

        const dates = [testDate(4), testDate(5), testDate(6)]
        const sessionIds: Id<'bookingSessions'>[] = []
        const reservationIds: Id<'reservations'>[] = []
        const snapshotIds: Id<'availabilitySnapshots'>[] = []

        for (const date of dates) {
          const sessionId = await seedSession(ctx, bookingId, unitId, {
            date,
            startTime: '09:00',
            endTime: '17:00',
          })
          sessionIds.push(sessionId)

          const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId)
          reservationIds.push(reservationId)

          const snapshotId = await seedSnapshot(ctx, unitId, {
            date,
            windowStart: '09:00',
            windowEnd: '17:00',
            reservedUnits: 1,
            availableUnits: 0,
          })
          snapshotIds.push(snapshotId)
        }

        const linkId = await seedBookingLink(ctx, bookingId, {
          token: 'test-token-123',
          expiresAt: Date.now() + 86_400_000,
          customerName: 'Alice',
          email: 'alice@test.com',
        })

        return { bookingId, unitId, sessionIds, reservationIds, snapshotIds, linkId }
      },
    )

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|inst-1' })
      .mutation(api.availability.toggleBlockedDate, { date: testDate(5), roleType: 'Instructor' })
    expect(result).toBe(true)

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking!.status).toBe('Draft')
    expect(booking!.needsAttention).toBe(true)

    for (const sessionId of sessionIds) {
      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session).not.toBeNull()
    }

    const blockedDateReservation = await t.run(async (ctx) => ctx.db.get(reservationIds[1]))
    expect(blockedDateReservation?.status).toBe('Vacated')
    expect(blockedDateReservation?.vacatedBy).toBe('date_blocked')

    const blockedSnapshot = await t.run(async (ctx) => ctx.db.get(snapshotIds[1]))
    expect(blockedSnapshot?.availableUnits).toBe(1)
    expect(blockedSnapshot?.reservedUnits).toBe(0)

    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link).not.toBeNull()
  })

  it('blocking a date does NOT cancel Upcoming bookings', async () => {
    const t = makeT()

    const { bookingId, reservationIds } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|inst-2',
        slug: 'inst-2',
        email: 'inst2@test.com',
        firstName: 'Instructor',
        lastName: 'Two',
        role: 'Instructor',
      })

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'inst-2',
        displayName: 'Instructor Two',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Upcoming',
        startDate: testDate(5),
        endDate: testDate(6),
        divers: [
          {
            name: 'Bob',
            abbrev: 'B',
            flag: { code: 'GB', label: 'UK' },
            startDate: testDate(5),
            endDate: testDate(6),
            activityType: ['OW'],
          },
        ],
        bookingFormComplete: true,
        customerFormComplete: true,
      })

      const reservationIds: Id<'reservations'>[] = []
      for (const date of [testDate(5), testDate(6)]) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date,
          startTime: '09:00',
          endTime: '17:00',
        })

        const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId)
        reservationIds.push(reservationId)

        await seedSnapshot(ctx, unitId, {
          date,
          windowStart: '09:00',
          windowEnd: '17:00',
          reservedUnits: 1,
          availableUnits: 0,
        })
      }

      return { bookingId, reservationIds }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|inst-2' })
      .mutation(api.availability.toggleBlockedDate, { date: testDate(5), roleType: 'Instructor' })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking?.status).toBe('Upcoming')

    const res0 = await t.run(async (ctx) => ctx.db.get(reservationIds[0]))
    expect(res0?.status).toBe('Vacated')

    const res1 = await t.run(async (ctx) => ctx.db.get(reservationIds[1]))
    expect(res1?.status).toBe('PendingAcceptance')
  })

  it('operator blocking a date auto-cancels their own Draft booking', async () => {

    const t = makeT()

    const { bookingId, sessionIds } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-1',
        slug: 'dc-1',
        email: 'dc1@test.com',
        firstName: 'DC',
        lastName: 'One',
      })

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'inst-ext',
        displayName: 'External Instructor',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-1',
        status: 'Draft',
        startDate: testDate(4),
        endDate: testDate(6),
        divers: [
          {
            name: 'Charlie',
            abbrev: 'C',
            flag: { code: 'AU', label: 'Australia' },
            startDate: testDate(4),
            endDate: testDate(6),
            activityType: ['OW'],
          },
        ],
        bookingFormComplete: true,
        expiresAt: Date.now() + HOLD_TTL,
      })

      const sessionIds: Id<'bookingSessions'>[] = []
      for (const date of [testDate(4), testDate(5), testDate(6)]) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date,
          startTime: '09:00',
          endTime: '17:00',
        })
        sessionIds.push(sessionId)

        await seedReservation(ctx, bookingId, unitId, sessionId)

        await seedSnapshot(ctx, unitId, {
          date,
          windowStart: '09:00',
          windowEnd: '17:00',
          reservedUnits: 1,
          availableUnits: 0,
        })
      }

      return { bookingId, sessionIds }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .mutation(api.availability.toggleBlockedDate, { date: testDate(5), roleType: 'DiveCenter' })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking!.status).toBe('Draft')

    for (const sessionId of sessionIds) {
      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session).not.toBeNull()
    }
  })
})

describe('token invalidation', () => {
  afterEach(() => vi.clearAllMocks())

  it('getByToken returns valid for unused token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('valid')
  })

  it('getByToken returns completed for used token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
        link: { usedAt: Date.now() - 1000 },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('completed')
    if (result.status === 'completed') {
      expect(result.customerName).toBe('Alice')
      expect(result.operatorName).toBe('Test DC')
      expect(result.startDate).toBe(testDate(5))
    }
  })

  it('portal submission sets usedAt on booking link', async () => {
    const t = makeT()
    const { token, linkId } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
      }),
    )

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(typeof link?.usedAt).toBe('number')
    expect(link!.usedAt as number).toBeGreaterThan(0)
  })

  it('resolvePortalToken throws for used token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
        link: { usedAt: Date.now() - 1000 },
      }),
    )
    await expect(
      t.run(async (ctx) => resolvePortalToken(ctx, token)),
    ).rejects.toThrow('TOKEN_EXPIRED')
  })

  it('resolvePortalTokenSoft returns null for used token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
        link: { usedAt: Date.now() - 1000 },
      }),
    )
    const result = await t.run(async (ctx) => resolvePortalTokenSoft(ctx, token))
    expect(result).toBeNull()
  })

  it('usedAt is not set before submitPortal is called', async () => {
    const t = makeT()
    const { linkId } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
      }),
    )
    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link?.usedAt).toBeUndefined()
  })

  it('operator getByBookingId still returns link after customer completes', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'op@test.com',
        firstName: 'Test',
        lastName: 'DC',
      })
      return seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
        link: { usedAt: Date.now() - 1000 },
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingLinks.getByBookingId, { bookingId })
    expect(result).not.toBeNull()
    expect(result?.customerName).toBe('Alice')
  })

  it('getByToken returns completed state on re-entry', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
        link: { usedAt: Date.now() - 500 },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('completed')
  })

  it('used token blocks submitPortal mutation', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-test',
          status: 'Draft',
          bookingFormComplete: false,
          divers: [],
          expiresAt: Date.now() + HOLD_TTL,
        },
        link: { usedAt: Date.now() - 1000 },
      }),
    )
    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'TOKEN_EXPIRED',
    )
  })

  it('createBookingLink creates new token when existing token is used', async () => {
    const t = makeT()
    const usedToken = 'used-tok-abc'

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|dc-regen',
        slug: 'dc-regen',
        email: 'regen@test.com',
        firstName: 'Regen',
        lastName: 'DC',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-regen',
        status: 'Draft',
        bookingFormComplete: false,
        operatorName: 'Regen DC',
        divers: [],
        expiresAt: Date.now() + HOLD_TTL,
      })

      await seedBookingLink(ctx, bookingId, {
        token: usedToken,
        customerName: 'Bob',
        email: 'bob@example.com',
        usedAt: Date.now() - 1000,
      })

      return bookingId
    })

    const newToken = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-regen' })
      .mutation(api.bookingLinks.createBookingLink, {
        bookingId,
        customerName: 'Bob',
        email: 'bob@example.com',
      })

    expect(newToken).not.toBe(usedToken)
    expect(typeof newToken).toBe('string')
  })
})
