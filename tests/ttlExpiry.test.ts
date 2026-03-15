import { convexTest } from 'convex-test'
import { describe, it, expect, afterEach, vi } from 'vitest'
import schema from '../convex/schema'
import { internal } from '../convex/_generated/api'
import { isSessionEnded } from '../convex/bookings/_shared'

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
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-16T10:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '17:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exceeds session end time on the same day', () => {
    // Mock: 2024-06-15 12:00 UTC → Bangkok 2024-06-15 19:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exactly equals session end time', () => {
    // Mock: 2024-06-15 11:00 UTC → Bangkok 2024-06-15 18:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T11:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns false when session has not ended yet', () => {
    // Mock: 2024-06-15 09:00 UTC → Bangkok 2024-06-15 16:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T09:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'Asia/Bangkok')).toBe(false)
  })

  it('returns false when current date is before session date', () => {
    // Mock: 2024-06-14 10:00 UTC → Bangkok 2024-06-14 17:00; session is 2024-06-15
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-14T10:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '08:00', 'Asia/Bangkok')).toBe(false)
  })

  it('works with UTC timezone', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T18:01:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'UTC')).toBe(true)
  })

  it('handles midnight boundary (session ending at 00:00 next day)', () => {
    // 2024-06-15T17:01:00Z → Bangkok 2024-06-16 00:01; session 2024-06-15 ending 23:59
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T17:01:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '23:59', 'Asia/Bangkok')).toBe(true)
  })
})

// ─── expireHolds ───────────────────────────────────────────────────────────────

describe('expireHolds', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns { expired: 0, more: false } when no bookings have expired', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-15',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() + 10_000,
      })
    })

    const result = await t.mutation(internal.bookings.status.expireHolds, {})
    expect(result).toEqual({ expired: 0, more: false })
  })

  it('deletes a booking whose expiresAt is in the past', async () => {
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
        startDate: '2025-06-15',
        endDate: '2025-06-15',
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

    const result = await t.mutation(internal.bookings.status.expireHolds, {})
    expect(result).toEqual({ expired: 1, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).toBeNull()
  })

  it('skips bookings with no expiresAt', async () => {
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
        startDate: '2025-06-15',
        endDate: '2025-06-15',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
        // No expiresAt
      }),
    )

    const result = await t.mutation(internal.bookings.status.expireHolds, {})
    expect(result).toEqual({ expired: 0, more: false })

    // Booking should still exist
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
  })

  it('reports more: true when there are >100 expired bookings', async () => {
    const t = makeT()
    const past = Date.now() - 1_000

    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++) {
        await ctx.db.insert('bookings', {
          ownerId: 'dc-test',
          ownerType: 'DiveCenter',
          status: 'Draft',
          createdAt: Date.now(),
          holdTTL: HOLD_TTL,
          paid: false,
          activityType: ['OW'],
          startDate: '2025-06-15',
          endDate: '2025-06-15',
          divers: [],
          operatorName: 'Test DC',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          medicalHardBlock: false,
          bookingFormComplete: true,
          customerFormComplete: false,
          expiresAt: past,
        })
      }
    })

    const result = (await t.mutation(internal.bookings.status.expireHolds, {})) as {
      expired: number
      more: boolean
    }
    expect(result.expired).toBe(100)
    expect(result.more).toBe(true)
  })

  it('expires multiple bookings in the same run', async () => {
    const t = makeT()
    const past = Date.now() - 1_000

    const [id1, id2] = await t.run(async (ctx) => {
      const id1 = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-15',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: past,
      })
      const id2 = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-16',
        endDate: '2025-06-16',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: past,
      })
      return [id1, id2]
    })

    const result = await t.mutation(internal.bookings.status.expireHolds, {})
    expect(result).toEqual({ expired: 2, more: false })

    const [b1, b2] = await t.run(async (ctx) => [
      await ctx.db.get(id1),
      await ctx.db.get(id2),
    ])
    expect(b1).toBeNull()
    expect(b2).toBeNull()
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
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T08:00:00Z').getTime())

    await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2024-06-15',
        endDate: '2024-06-15',
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
        date: '2024-06-15',
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
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2024-06-15',
        endDate: '2024-06-15',
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
        date: '2024-06-15',
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
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())

    const bookingId = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2024-06-14',
        endDate: '2024-06-15',
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
        date: '2024-06-14',
        startTime: '08:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })
      // Last session — check this one
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2024-06-15',
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
        startDate: '2024-06-15',
        endDate: '2024-06-15',
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
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())

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
          startDate: '2024-06-15',
          endDate: '2024-06-15',
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
          date: '2024-06-15',
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
