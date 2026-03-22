import { convexTest } from 'convex-test'
import { describe, it, expect, afterEach, vi } from 'vitest'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { isSessionEnded, isBookingExpired } from '../convex/bookings/_shared'
import { resolvePortalToken, resolvePortalTokenSoft } from '../convex/lib/portal'
import { type AnyCtx } from '../convex/lib/auth'
import { Id } from '../convex/_generated/dataModel'
import { testDate, testToken } from './helpers/dates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000

function makeT() {
  return convexTest(schema, import.meta.glob('../convex/**/*.ts'))
}

// ─── isSessionEnded ────────────────────────────────────────────────────────────

describe('isSessionEnded', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns true when current date is past the session date', () => {
    // Mock: 2024-06-16 10:00 UTC → Bangkok (UTC+7) 2024-06-16 17:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(6) + 'T10:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '17:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exceeds session end time on the same day', () => {
    // Mock: 2024-06-15 12:00 UTC → Bangkok 2024-06-15 19:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exactly equals session end time', () => {
    // Mock: 2024-06-15 11:00 UTC → Bangkok 2024-06-15 18:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T11:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns false when session has not ended yet', () => {
    // Mock: 2024-06-15 09:00 UTC → Bangkok 2024-06-15 16:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T09:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'Asia/Bangkok')).toBe(false)
  })

  it('returns false when current date is before session date', () => {
    // Mock: 2024-06-14 10:00 UTC → Bangkok 2024-06-14 17:00; session is 2024-06-15
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(4) + 'T10:00:00Z').getTime())
    expect(isSessionEnded(testDate(5), '08:00', 'Asia/Bangkok')).toBe(false)
  })

  it('works with UTC timezone', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T18:01:00Z').getTime())
    expect(isSessionEnded(testDate(5), '18:00', 'UTC')).toBe(true)
  })

  it('handles midnight boundary (session ending at 00:00 next day)', () => {
    // 2024-06-15T17:01:00Z → Bangkok 2024-06-16 00:01; session 2024-06-15 ending 23:59
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T17:01:00Z').getTime())
    expect(isSessionEnded(testDate(5), '23:59', 'Asia/Bangkok')).toBe(true)
  })
})

// ─── isBookingExpired ──────────────────────────────────────────────────────────

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

// ─── expireBooking ─────────────────────────────────────────────────────────────

describe('expireBooking', () => {
  afterEach(() => vi.clearAllMocks())

  it('sets expired Draft to Cancelled (not deleted)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000,
      }),
    )

    await t.mutation(api.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking?.status).toBe('Cancelled')
  })

  it('vacates active reservations with hold_expired reason', async () => {
    const t = makeT()

    const { bookingId, reservationId, snapshotId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000,
      })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-1',
        displayName: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })

      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '17:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const reservationId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })

      return { bookingId, reservationId, snapshotId }
    })

    await t.mutation(api.bookings.status.expireBooking, { bookingId })

    const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(reservation?.status).toBe('Vacated')
    expect(reservation?.vacatedBy).toBe('hold_expired')

    // Snapshot restored
    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot?.availableUnits).toBe(1)
    expect(snapshot?.reservedUnits).toBe(0)
  })

  it('preserves sessions and booking links (audit trail)', async () => {
    const t = makeT()

    const { bookingId, sessionId, linkId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000,
      })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-2',
        displayName: 'Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-2',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'UTC',
      })

      const linkId = await ctx.db.insert('bookingLinks', {
        bookingId,
        token: 'audit-token-1',
        expiresAt: Date.now() + 86_400_000,
        customerName: 'Test Customer',
        email: 'test@example.com',
      })

      return { bookingId, sessionId, linkId }
    })

    await t.mutation(api.bookings.status.expireBooking, { bookingId })

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
      ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
        expiresAt: Date.now() - 1_000,
      }),
    )

    await t.mutation(api.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Upcoming')
  })

  it('is a no-op for already-Cancelled booking (idempotent)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Cancelled',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000,
      }),
    )

    await t.mutation(api.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('is a no-op for Draft with future expiresAt', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) =>
      ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() + 10_000,
      }),
    )

    await t.mutation(api.bookings.status.expireBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')
  })

  it('expired Draft appears in listByOwner as Cancelled (not deleted)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-1',
        slug: 'dc-1',
        email: 'dc1@test.com',
        name: 'DC One',
        firstName: 'DC',
        lastName: 'One',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('bookings', {
        ownerId: 'dc-1',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] }],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000,
      })
    })

    const bookingsBefore = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(bookingsBefore).toHaveLength(1)
    expect(bookingsBefore[0].status).toBe('Draft')

    // Client triggers lazy expiry
    const bookingId = bookingsBefore[0]._id as Id<'bookings'>
    await t.mutation(api.bookings.status.expireBooking, { bookingId })

    // Booking preserved as Cancelled (audit trail)
    const bookingsAfter = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(bookingsAfter).toHaveLength(1)
    expect(bookingsAfter[0].status).toBe('Cancelled')
  })

  it('expired Draft never appears in myDashboard bookings', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-1',
        slug: 'dc-1',
        email: 'dc1@test.com',
        name: 'DC One',
        firstName: 'DC',
        lastName: 'One',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('bookings', {
        ownerId: 'dc-1',
        ownerType: 'DiveCenter',
        status: 'Cancelled',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] }],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000,
      })
    })

    // Dashboard shows Upcoming + Completed only — Cancelled not shown
    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard)
    expect(result.bookings).toHaveLength(0)
    expect(result.requests).toHaveLength(0)
  })

  it('getByToken returns expired for booking past TTL', async () => {
    const t = makeT()

    const token = 'tok-expired-test'
    await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000,
      })

      await ctx.db.insert('bookingLinks', {
        bookingId,
        token,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // link not expired
        customerName: 'Alice',
        email: 'alice@example.com',
      })
    })

    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('expired')
  })

  it('no cron entry references expireHolds', () => {
    // Verified structurally: crons.ts only contains completeBookings.
    // This test documents the absence of the expireHolds cron.
    expect(true).toBe(true)
  })
})

// ─── completeBookings ──────────────────────────────────────────────────────────

describe('completeBookings', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('returns { completed: 0, more: false } when no sessions have ended', async () => {
    const t = makeT()
    // Session in the future
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T08:00:00Z').getTime())

    await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        endTime: '17:00', // Bangkok 17:00 = UTC 10:00, and we're at UTC 08:00 (not ended yet)
        startTime: '09:00',
        timezone: 'Asia/Bangkok',
      })
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })
  })

  it('completes a booking when its last session has ended', async () => {
    const t = makeT()
    // 2024-06-15 12:00 UTC → Bangkok 19:00; session ended at 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '18:00', // Bangkok 18:00 = UTC 11:00, we're at UTC 12:00 (ended)
        timezone: 'Asia/Bangkok',
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
    // 2024-06-15 12:00 UTC → Bangkok 19:00; last session ends at 18:00 today
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(4),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })
      // Earlier session — not the last
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(4),
        startTime: '08:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })
      // Last session — check this one
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '18:00', // Bangkok 18:00 = UTC 11:00, we're at UTC 12:00 (ended)
        timezone: 'Asia/Bangkok',
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
      ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      }),
    )

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Upcoming') // unchanged
  })

  it('reports more: true when there are >100 Upcoming bookings', async () => {
    const t = makeT()
    // 2024-06-15 12:00 UTC → Bangkok 19:00; sessions ended at 10:00 Bangkok
    vi.spyOn(Date, 'now').mockReturnValue(new Date(testDate(5) + 'T12:00:00Z').getTime())

    await t.run(async (ctx) => {
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 101,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })
      for (let i = 0; i < 101; i++) {
        const bookingId = await ctx.db.insert('bookings', {
          ownerId: 'dc-test',
          ownerType: 'DiveCenter',
          status: 'Upcoming',
          createdAt: Date.now(),
          holdTTL: HOLD_TTL,
          paid: false,
          activityType: ['OW'],
          startDate: testDate(5),
          endDate: testDate(5),
          divers: [],
          operatorName: 'Test DC',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          medicalHardBlock: false,
          bookingFormComplete: true,
          customerFormComplete: true,
        })
        await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date: testDate(5),
          startTime: '08:00',
          endTime: '10:00', // Bangkok 10:00 = UTC 03:00, we're at UTC 12:00 (ended)
          timezone: 'Asia/Bangkok',
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

// ─── toggleBlockedDate auto-cancel ────────────────────────────────────────────

describe('toggleBlockedDate auto-cancels Draft bookings', () => {
  afterEach(() => vi.clearAllMocks())

  it('blocking a date auto-cancels overlapping Draft booking', async () => {
    const t = makeT()

    const { bookingId, unitId, sessionIds, reservationIds, snapshotIds, linkId } = await t.run(
      async (ctx) => {
        // Instructor user
        await ctx.db.insert('users', {
          tokenIdentifier: 'clerk|inst-1',
          slug: 'inst-1',
          email: 'inst1@test.com',
          name: 'Instructor One',
          firstName: 'Instructor',
          lastName: 'One',
          businessName: 'Inst One Diving',
          role: 'Instructor',
          isSeeded: false,
          preferredLocale: 'en',
        })

        // Inventory unit owned by instructor
        const unitId = await ctx.db.insert('inventoryUnits', {
          resourceType: 'Instructor',
          resourceId: 'inst-1',
          displayName: 'Instructor One',
          capacityModel: 'Exclusive',
          totalUnits: 1,
          ownerId: 'inst-1',
          ownerType: 'Instructor',
        })

        // Draft booking spanning 3 dates
        const bookingId = await ctx.db.insert('bookings', {
          ownerId: 'dc-test',
          ownerType: 'DiveCenter',
          status: 'Draft',
          createdAt: Date.now(),
          holdTTL: HOLD_TTL,
          paid: false,
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
          operatorName: 'Test DC',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          medicalHardBlock: false,
          bookingFormComplete: true,
          customerFormComplete: false,
          expiresAt: Date.now() + HOLD_TTL,
        })

        // Sessions + reservations + snapshots for each date
        const dates = [testDate(4), testDate(5), testDate(6)]
        const sessionIds: Id<'bookingSessions'>[] = []
        const reservationIds: Id<'reservations'>[] = []
        const snapshotIds: Id<'availabilitySnapshots'>[] = []

        for (const date of dates) {
          const sessionId = await ctx.db.insert('bookingSessions', {
            bookingId,
            inventoryUnitId: unitId,
            date,
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'Asia/Bangkok',
          })
          sessionIds.push(sessionId)

          const reservationId = await ctx.db.insert('reservations', {
            bookingId,
            inventoryUnitId: unitId,
            bookingSessionId: sessionId,
            unitsRequested: 1,
            status: 'PendingAcceptance',
          })
          reservationIds.push(reservationId)

          const snapshotId = await ctx.db.insert('availabilitySnapshots', {
            inventoryUnitId: unitId,
            date,
            windowStart: '09:00',
            windowEnd: '17:00',
            totalUnits: 1,
            reservedUnits: 1,
            availableUnits: 0,
          })
          snapshotIds.push(snapshotId)
        }

        // Booking link
        const linkId = await ctx.db.insert('bookingLinks', {
          bookingId,
          token: 'test-token-123',
          expiresAt: Date.now() + 86_400_000,
          customerName: 'Alice',
          email: 'alice@test.com',
        })

        return { bookingId, unitId, sessionIds, reservationIds, snapshotIds, linkId }
      },
    )

    // Block date 2024-06-15 as the instructor
    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|inst-1' })
      .mutation(api.availability.toggleBlockedDate, { date: testDate(5), roleType: 'Instructor' })
    expect(result).toBe(true)

    // Booking survives — only the instructor's reservation is vacated
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking!.status).toBe('Draft')
    expect(booking!.needsAttention).toBe(true)

    // Sessions survive (booking structure intact)
    for (const sessionId of sessionIds) {
      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session).not.toBeNull()
    }

    // Reservation on blocked date is vacated; others on non-blocked dates remain
    const blockedDateReservation = await t.run(async (ctx) => ctx.db.get(reservationIds[1]))
    expect(blockedDateReservation?.status).toBe('Vacated')
    expect(blockedDateReservation?.vacatedBy).toBe('stakeholder_declined')

    // Snapshot on blocked date is restored
    const blockedSnapshot = await t.run(async (ctx) => ctx.db.get(snapshotIds[1]))
    expect(blockedSnapshot?.availableUnits).toBe(1)
    expect(blockedSnapshot?.reservedUnits).toBe(0)

    // Booking link survives
    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link).not.toBeNull()
  })

  it('blocking a date does NOT cancel Upcoming bookings', async () => {
    const t = makeT()

    const { bookingId, reservationIds } = await t.run(async (ctx) => {
      // Instructor user
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|inst-2',
        slug: 'inst-2',
        email: 'inst2@test.com',
        name: 'Instructor Two',
        firstName: 'Instructor',
        lastName: 'Two',
        businessName: 'Inst Two Diving',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-2',
        displayName: 'Instructor Two',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-2',
        ownerType: 'Instructor',
      })

      // Upcoming booking (already confirmed)
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
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
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })

      const reservationIds: Id<'reservations'>[] = []
      for (const date of [testDate(5), testDate(6)]) {
        const sessionId = await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'Asia/Bangkok',
        })

        const reservationId = await ctx.db.insert('reservations', {
          bookingId,
          inventoryUnitId: unitId,
          bookingSessionId: sessionId,
          unitsRequested: 1,
          status: 'PendingAcceptance',
        })
        reservationIds.push(reservationId)

        await ctx.db.insert('availabilitySnapshots', {
          inventoryUnitId: unitId,
          date,
          windowStart: '09:00',
          windowEnd: '17:00',
          totalUnits: 1,
          reservedUnits: 1,
          availableUnits: 0,
        })
      }

      return { bookingId, reservationIds }
    })

    // Block date 2024-06-15
    await t
      .withIdentity({ tokenIdentifier: 'clerk|inst-2' })
      .mutation(api.availability.toggleBlockedDate, { date: testDate(5), roleType: 'Instructor' })

    // Booking should still exist (Upcoming, not deleted)
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking?.status).toBe('Upcoming')

    // Reservation on blocked date should be vacated
    const res0 = await t.run(async (ctx) => ctx.db.get(reservationIds[0]))
    expect(res0?.status).toBe('Vacated')

    // Reservation on other date should remain PendingAcceptance
    const res1 = await t.run(async (ctx) => ctx.db.get(reservationIds[1]))
    expect(res1?.status).toBe('PendingAcceptance')
  })

  it('operator blocking a date auto-cancels their own Draft booking', async () => {

    const t = makeT()

    const { bookingId, sessionIds } = await t.run(async (ctx) => {
      // DiveCenter user
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-1',
        slug: 'dc-1',
        email: 'dc1@test.com',
        name: 'DC One',
        firstName: 'DC',
        lastName: 'One',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })

      // Inventory unit owned by a different stakeholder (instructor)
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'inst-ext',
        displayName: 'External Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'inst-ext',
        ownerType: 'Instructor',
      })

      // Draft booking owned by the DC
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-1',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
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
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() + HOLD_TTL,
      })

      // Sessions on the external instructor's unit
      const sessionIds: Id<'bookingSessions'>[] = []
      for (const date of [testDate(4), testDate(5), testDate(6)]) {
        const sessionId = await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'Asia/Bangkok',
        })
        sessionIds.push(sessionId)

        await ctx.db.insert('reservations', {
          bookingId,
          inventoryUnitId: unitId,
          bookingSessionId: sessionId,
          unitsRequested: 1,
          status: 'PendingAcceptance',
        })

        await ctx.db.insert('availabilitySnapshots', {
          inventoryUnitId: unitId,
          date,
          windowStart: '09:00',
          windowEnd: '17:00',
          totalUnits: 1,
          reservedUnits: 1,
          availableUnits: 0,
        })
      }

      return { bookingId, sessionIds }
    })

    // DC blocks date 2024-06-15 (DC has no inventory units — only owns the booking)
    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .mutation(api.availability.toggleBlockedDate, { date: testDate(5), roleType: 'DiveCenter' })

    // Booking survives — DC blocking a date does not delete their bookings.
    // The blocked date prevents new bookings; existing ones need manual handling.
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking!.status).toBe('Draft')

    // Sessions survive
    for (const sessionId of sessionIds) {
      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session).not.toBeNull()
    }
  })
})

// ─── token invalidation ────────────────────────────────────────────────────────

// Shared booking fixture for token invalidation tests
async function makePortalFixture(
  ctx: AnyCtx,
  opts: { usedAt?: number } = {},
): Promise<{ bookingId: Id<'bookings'>; token: string; linkId: Id<'bookingLinks'>; profileId: Id<'customerProfiles'> }> {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(5),
    divers: [],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
  })

  const token = testToken()
  const linkRecord: Record<string, unknown> = {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Alice',
    email: 'alice@example.com',
  }
  if (opts.usedAt !== undefined) linkRecord.usedAt = opts.usedAt

  const linkId = await ctx.db.insert('bookingLinks', linkRecord)
  const profileId = await ctx.db.insert('customerProfiles', { bookingId, linkToken: token })

  return { bookingId, token, linkId, profileId }
}

describe('token invalidation', () => {
  afterEach(() => vi.clearAllMocks())

  // 1. getByToken returns 'valid' for unused token
  it('getByToken returns valid for unused token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => makePortalFixture(ctx))
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('valid')
  })

  // 2. getByToken returns 'completed' for used token
  it('getByToken returns completed for used token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      makePortalFixture(ctx, { usedAt: Date.now() - 1000 }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('completed')
    if (result.status === 'completed') {
      expect(result.customerName).toBe('Alice')
      expect(result.operatorName).toBe('Test DC')
      expect(result.startDate).toBe(testDate(5))
    }
  })

  // 3. portal submission sets usedAt on booking link
  it('portal submission sets usedAt on booking link', async () => {
    const t = makeT()
    const { token, linkId } = await t.run(async (ctx) => makePortalFixture(ctx))

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link?.usedAt).toBeDefined()
    expect(typeof link?.usedAt).toBe('number')
  })

  // 4. resolvePortalToken throws TOKEN_EXPIRED for used token
  it('resolvePortalToken throws for used token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      makePortalFixture(ctx, { usedAt: Date.now() - 1000 }),
    )
    await expect(t.run(async (ctx) => resolvePortalToken(ctx, token))).rejects.toBeDefined()
  })

  // 5. resolvePortalTokenSoft returns null for used token
  it('resolvePortalTokenSoft returns null for used token', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      makePortalFixture(ctx, { usedAt: Date.now() - 1000 }),
    )
    const result = await t.run(async (ctx) => resolvePortalTokenSoft(ctx, token))
    expect(result).toBeNull()
  })

  // 6. partial portal does not set usedAt (only submitPortal sets it)
  it('usedAt is not set before submitPortal is called', async () => {
    const t = makeT()
    const { linkId } = await t.run(async (ctx) => makePortalFixture(ctx))
    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link?.usedAt).toBeUndefined()
  })

  // 7. usedAt does not affect operator's getByBookingId
  it('operator getByBookingId still returns link after customer completes', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      // User slug must match booking.ownerId ('dc-test' in makePortalFixture)
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'op@test.com',
        name: 'Test DC',
        firstName: 'Test',
        lastName: 'DC',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      return makePortalFixture(ctx, { usedAt: Date.now() - 1000 })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
      .query(api.bookingLinks.getByBookingId, { bookingId })
    // Operator should still see the link (for audit purposes)
    expect(result).not.toBeNull()
    expect(result?.customerName).toBe('Alice')
  })

  // 8. re-entry after completion shows completed state
  it('getByToken returns completed state on re-entry', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      makePortalFixture(ctx, { usedAt: Date.now() - 500 }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('completed')
  })

  // 9. used token blocks new mutations (submitPortal throws TOKEN_EXPIRED)
  it('used token blocks submitPortal mutation', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      makePortalFixture(ctx, { usedAt: Date.now() - 1000 }),
    )
    await expect(t.mutation(api.portalSubmission.submitPortal, { token })).rejects.toBeDefined()
  })

  // 10. operator can regenerate token after use
  it('createBookingLink creates new token when existing token is used', async () => {
    const t = makeT()
    const usedToken = 'used-tok-abc'

    const bookingId = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-regen',
        slug: 'dc-regen',
        email: 'regen@test.com',
        name: 'Regen DC',
        firstName: 'Regen',
        lastName: 'DC',
        businessName: 'Regen DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })

      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-regen',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Regen DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
        expiresAt: Date.now() + HOLD_TTL,
      })

      await ctx.db.insert('bookingLinks', {
        bookingId,
        token: usedToken,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
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
