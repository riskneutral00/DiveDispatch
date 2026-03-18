import { convexTest } from 'convex-test'
import { describe, it, expect, afterEach, vi } from 'vitest'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { isSessionEnded } from '../convex/bookings/_shared'
import { Id } from '../convex/_generated/dataModel'

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

  it('expired Draft is excluded from listByOwner after expireHolds runs', async () => {
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
        startDate: '2026-03-16',
        endDate: '2026-03-18',
        divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: '2026-03-16', endDate: '2026-03-18', activityType: ['OW'] }],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: false,
        expiresAt: Date.now() - 1_000, // already expired
      })
    })

    // Before cron: booking is still in DB, visible on calendar
    const before = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(before).toHaveLength(1)

    // Cron runs
    await t.mutation(internal.bookings.status.expireHolds, {})

    // After cron: booking hard-deleted, gone from calendar
    const after = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.listByOwner, { ownerId: 'dc-1', ownerType: 'DiveCenter' })
    expect(after).toHaveLength(0)
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
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2026-03-16',
        endDate: '2026-03-18',
        divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: '2026-03-16', endDate: '2026-03-18', activityType: ['OW'] }],
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

    // Dashboard never shows Drafts (operators see Upcoming + Completed only)
    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-1' })
      .query(api.bookings.myDashboard)
    expect(result.bookings).toHaveLength(0)
    expect(result.requests).toHaveLength(0)
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
          startDate: '2024-06-14',
          endDate: '2024-06-16',
          divers: [
            {
              name: 'Alice',
              abbrev: 'A',
              flag: { code: 'US', label: 'USA' },
              startDate: '2024-06-14',
              endDate: '2024-06-16',
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
          instructorId: 'inst-1',
          expiresAt: Date.now() + HOLD_TTL,
        })

        // Sessions + reservations + snapshots for each date
        const dates = ['2024-06-14', '2024-06-15', '2024-06-16']
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
      .mutation(api.availability.toggleBlockedDate, { date: '2024-06-15', roleType: 'Instructor' })
    expect(result).toBe(true)

    // Booking should be hard-deleted
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).toBeNull()

    // All sessions should be deleted
    for (const sessionId of sessionIds) {
      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session).toBeNull()
    }

    // All reservations should be vacated
    for (const reservationId of reservationIds) {
      const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
      expect(reservation?.status).toBe('Vacated')
      expect(reservation?.vacatedBy).toBe('stakeholder_declined')
    }

    // All snapshots should be restored (availableUnits back to 1)
    for (const snapshotId of snapshotIds) {
      const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
      expect(snapshot?.availableUnits).toBe(1)
      expect(snapshot?.reservedUnits).toBe(0)
    }

    // Booking link should be deleted
    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link).toBeNull()
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
        startDate: '2024-06-15',
        endDate: '2024-06-16',
        divers: [
          {
            name: 'Bob',
            abbrev: 'B',
            flag: { code: 'GB', label: 'UK' },
            startDate: '2024-06-15',
            endDate: '2024-06-16',
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
        instructorId: 'inst-2',
      })

      const reservationIds: Id<'reservations'>[] = []
      for (const date of ['2024-06-15', '2024-06-16']) {
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
      .mutation(api.availability.toggleBlockedDate, { date: '2024-06-15', roleType: 'Instructor' })

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
        startDate: '2024-06-14',
        endDate: '2024-06-16',
        divers: [
          {
            name: 'Charlie',
            abbrev: 'C',
            flag: { code: 'AU', label: 'Australia' },
            startDate: '2024-06-14',
            endDate: '2024-06-16',
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
        instructorId: 'inst-ext',
        expiresAt: Date.now() + HOLD_TTL,
      })

      // Sessions on the external instructor's unit
      const sessionIds: Id<'bookingSessions'>[] = []
      for (const date of ['2024-06-14', '2024-06-15', '2024-06-16']) {
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
      .mutation(api.availability.toggleBlockedDate, { date: '2024-06-15', roleType: 'DiveCenter' })

    // Booking should be hard-deleted
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).toBeNull()

    // All sessions should be deleted
    for (const sessionId of sessionIds) {
      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session).toBeNull()
    }
  })
})
