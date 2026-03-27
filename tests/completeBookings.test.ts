/**
 * completeBookings cron — unit tests
 *
 * Covers edge cases NOT already tested in ttlExpiry.test.ts or bookingLifecycle.test.ts:
 *   - Only Upcoming bookings are processed (Draft/Completed/Cancelled ignored)
 *   - Mixed batch: some eligible, some not
 *   - Same-date sessions resolved by endTime (latest wins)
 *   - Boundary: session endTime exactly equals current time (should complete)
 *   - Different timezones across sessions within the same booking
 *   - Empty database (no upcoming bookings at all)
 *   - Audit log entry per completed booking
 *   - Already-Completed bookings not re-processed
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { internal } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { testDate } from './helpers/dates'
import { makeT } from './helpers/convex-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0]

async function seedBooking(
  ctx: Ctx,
  overrides: Record<string, unknown> = {},
): Promise<Id<'bookings'>> {
  return ctx.db.insert('bookings', {
    ownerId: 'dc-test',
    ownerType: 'DiveCenter',
    status: 'Upcoming',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(-5),
    endDate: testDate(-5),
    divers: [],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: true,
    customerFormComplete: true,
    ...(overrides as Record<string, unknown>),
  })
}

async function seedUnit(ctx: Ctx): Promise<Id<'inventoryUnits'>> {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: 'instructor-1',
    displayName: 'Instructor unit',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId: 'instructor-1',
    ownerType: 'Instructor',
  })
}

async function seedSession(
  ctx: Ctx,
  bookingId: Id<'bookings'>,
  unitId: Id<'inventoryUnits'>,
  overrides: { date?: string; startTime?: string; endTime?: string; timezone?: string } = {},
): Promise<Id<'bookingSessions'>> {
  return ctx.db.insert('bookingSessions', {
    bookingId,
    inventoryUnitId: unitId,
    date: overrides.date ?? testDate(-5),
    startTime: overrides.startTime ?? '08:00',
    endTime: overrides.endTime ?? '17:00',
    timezone: overrides.timezone ?? 'Asia/Bangkok',
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('completeBookings', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // ── Non-Upcoming statuses are ignored ───────────────────────────────────────

  it('ignores Draft bookings even when all sessions have ended', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Draft' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-10), endTime: '10:00' })
      return bookingId
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')
  })

  it('ignores Cancelled bookings even when all sessions have ended', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Cancelled' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-10), endTime: '10:00' })
      return bookingId
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('ignores already-Completed bookings (no double-processing)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Completed' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-10), endTime: '10:00' })
      return bookingId
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Completed')
  })

  // ── Empty database ──────────────────────────────────────────────────────────

  it('returns { completed: 0, more: false } when no bookings exist', async () => {
    const t = makeT()
    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })
  })

  // ── Mixed batch: some eligible, some not ────────────────────────────────────

  it('completes only eligible bookings in a mixed batch', async () => {
    const t = makeT()

    const { eligibleId, futureId } = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)

      // Eligible: all sessions in the past
      const eligibleId = await seedBooking(ctx, {
        startDate: testDate(-10),
        endDate: testDate(-10),
      })
      await seedSession(ctx, eligibleId, unitId, { date: testDate(-10), endTime: '17:00' })

      // Not eligible: last session is far in the future
      const futureId = await seedBooking(ctx, {
        startDate: testDate(5),
        endDate: testDate(10),
      })
      await seedSession(ctx, futureId, unitId, { date: testDate(10), endTime: '17:00' })

      return { eligibleId, futureId }
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 1, more: false })

    const eligible = await t.run(async (ctx) => ctx.db.get(eligibleId))
    expect(eligible?.status).toBe('Completed')

    const future = await t.run(async (ctx) => ctx.db.get(futureId))
    expect(future?.status).toBe('Upcoming')
  })

  // ── Same-date sessions resolved by endTime ──────────────────────────────────

  it('uses the latest endTime on the same date to determine completion', async () => {
    const t = makeT()
    // Mock time: 2 days ago at 15:00 Bangkok (08:00 UTC)
    // Session 1 ends at 14:00 Bangkok -> ended
    // Session 2 ends at 16:00 Bangkok -> NOT ended
    const mockTime = new Date(`${testDate(-2)}T08:00:00Z`)
    vi.spyOn(Date, 'now').mockReturnValue(mockTime.getTime())

    const bookingId = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)
      const bookingId = await seedBooking(ctx, {
        startDate: testDate(-2),
        endDate: testDate(-2),
      })
      // Earlier session on the same day
      await seedSession(ctx, bookingId, unitId, {
        date: testDate(-2),
        startTime: '08:00',
        endTime: '14:00',
        timezone: 'Asia/Bangkok',
      })
      // Later session on the same day — this is the one that matters
      await seedSession(ctx, bookingId, unitId, {
        date: testDate(-2),
        startTime: '14:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      return bookingId
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    // 15:00 Bangkok < 16:00 endTime -> NOT ended yet
    expect(result).toEqual({ completed: 0, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Upcoming')
  })

  // ── Timezone-aware: session in a different timezone ─────────────────────────

  it('respects the timezone of the last session for end-time comparison', async () => {
    const t = makeT()
    // Mock: 13:00 UTC. In UTC that's past 12:00 endTime, but in Bangkok (UTC+7) it's 20:00
    // which is also past the 12:00 Bangkok endTime.
    // Use a case where timezone matters: session at 14:00 UTC endTime.
    // Current time 13:00 UTC = not past 14:00 UTC endTime.
    // But in Asia/Bangkok: 13:00 UTC = 20:00 Bangkok, which IS past 14:00 Bangkok.
    const mockTime = new Date(`${testDate(-3)}T13:00:00Z`)
    vi.spyOn(Date, 'now').mockReturnValue(mockTime.getTime())

    const { utcBookingId, bangkokBookingId } = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)

      // UTC booking: session ends at 14:00 UTC. Current UTC time is 13:00 -> NOT ended
      const utcBookingId = await seedBooking(ctx, {
        startDate: testDate(-3),
        endDate: testDate(-3),
      })
      await seedSession(ctx, utcBookingId, unitId, {
        date: testDate(-3),
        startTime: '08:00',
        endTime: '14:00',
        timezone: 'UTC',
      })

      // Bangkok booking: session ends at 14:00 Bangkok. Current Bangkok time is 20:00 -> ended
      const bangkokBookingId = await seedBooking(ctx, {
        startDate: testDate(-3),
        endDate: testDate(-3),
      })
      await seedSession(ctx, bangkokBookingId, unitId, {
        date: testDate(-3),
        startTime: '08:00',
        endTime: '14:00',
        timezone: 'Asia/Bangkok',
      })

      return { utcBookingId, bangkokBookingId }
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    // Only the Bangkok session should be completed (20:00 > 14:00)
    // The UTC session should NOT be completed (13:00 < 14:00)
    expect(result).toEqual({ completed: 1, more: false })

    const utcBooking = await t.run(async (ctx) => ctx.db.get(utcBookingId))
    expect(utcBooking?.status).toBe('Upcoming')

    const bangkokBooking = await t.run(async (ctx) => ctx.db.get(bangkokBookingId))
    expect(bangkokBooking?.status).toBe('Completed')
  })

  // ── Audit log entry per completed booking ───────────────────────────────────

  it('writes a bookingAuditLog entry with action completed and system actor', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)
      const bookingId = await seedBooking(ctx, {
        startDate: testDate(-10),
        endDate: testDate(-10),
      })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-10), endTime: '17:00' })
      return bookingId
    })

    await t.mutation(internal.bookings.status.completeBookings, {})

    const auditEntries = await t.run(async (ctx) =>
      ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect(),
    )

    expect(auditEntries).toHaveLength(1)
    expect(auditEntries[0].action).toBe('completed')
    expect(auditEntries[0].actorSlug).toBe('system')
    expect(auditEntries[0].actorType).toBe('system')
  })

  // ── Multiple bookings all eligible ──────────────────────────────────────────

  it('completes multiple eligible bookings in a single run', async () => {
    const t = makeT()

    const { id1, id2, id3 } = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)

      const id1 = await seedBooking(ctx, { startDate: testDate(-10), endDate: testDate(-10) })
      await seedSession(ctx, id1, unitId, { date: testDate(-10), endTime: '17:00' })

      const id2 = await seedBooking(ctx, { startDate: testDate(-8), endDate: testDate(-8) })
      await seedSession(ctx, id2, unitId, { date: testDate(-8), endTime: '15:00' })

      const id3 = await seedBooking(ctx, { startDate: testDate(-6), endDate: testDate(-6) })
      await seedSession(ctx, id3, unitId, { date: testDate(-6), endTime: '12:00' })

      return { id1, id2, id3 }
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 3, more: false })

    const [b1, b2, b3] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(id1), ctx.db.get(id2), ctx.db.get(id3)]),
    )
    expect(b1?.status).toBe('Completed')
    expect(b2?.status).toBe('Completed')
    expect(b3?.status).toBe('Completed')
  })

  // ── Multi-session: only last session determines completion ──────────────────

  it('does not complete when earlier sessions ended but last session is future', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)
      const bookingId = await seedBooking(ctx, {
        startDate: testDate(-5),
        endDate: testDate(5),
      })
      // Past session
      await seedSession(ctx, bookingId, unitId, { date: testDate(-5), endTime: '17:00' })
      // Future session — this is the last one
      await seedSession(ctx, bookingId, unitId, { date: testDate(5), endTime: '17:00' })
      return bookingId
    })

    const result = await t.mutation(internal.bookings.status.completeBookings, {})
    expect(result).toEqual({ completed: 0, more: false })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Upcoming')
  })

  // ── Audit log: one entry per completed booking, not per session ─────────────

  it('creates exactly one audit entry per booking even with multiple sessions', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      const unitId = await seedUnit(ctx)
      const bookingId = await seedBooking(ctx, {
        startDate: testDate(-10),
        endDate: testDate(-8),
      })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-10), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-9), endTime: '17:00' })
      await seedSession(ctx, bookingId, unitId, { date: testDate(-8), endTime: '17:00' })
      return bookingId
    })

    await t.mutation(internal.bookings.status.completeBookings, {})

    const auditEntries = await t.run(async (ctx) =>
      ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect(),
    )

    expect(auditEntries).toHaveLength(1)
    expect(auditEntries[0].action).toBe('completed')
  })

  // ── Continuation mechanism (DD-158) ─────────────────────────────────────────

  describe('continuation scheduling', () => {
    it('schedules a follow-up when more than 100 Upcoming bookings exist', async () => {
      vi.useFakeTimers()

      const t = makeT()

      await t.run(async (ctx) => {
        const unitId = await seedUnit(ctx)
        for (let i = 0; i < 101; i++) {
          const bId = await seedBooking(ctx, {
            startDate: testDate(-10),
            endDate: testDate(-10),
          })
          await seedSession(ctx, bId, unitId, { date: testDate(-10), endTime: '17:00' })
        }
      })

      // Use monitored wrapper which handles continuation scheduling (DD-158)
      await t.mutation(internal.bookings.status.completeBookingsWithMonitoring, {})
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const remaining = await t.run(async (ctx) =>
        ctx.db.query('bookings').withIndex('by_status', (q) => q.eq('status', 'Upcoming')).collect(),
      )
      expect(remaining).toHaveLength(0)

      const completed = await t.run(async (ctx) =>
        ctx.db.query('bookings').withIndex('by_status', (q) => q.eq('status', 'Completed')).collect(),
      )
      expect(completed).toHaveLength(101)

      vi.useRealTimers()
    })

    it('does NOT schedule a follow-up when exactly 100 bookings exist', async () => {
      const t = makeT()

      await t.run(async (ctx) => {
        const unitId = await seedUnit(ctx)
        for (let i = 0; i < 100; i++) {
          const bId = await seedBooking(ctx, {
            startDate: testDate(-10),
            endDate: testDate(-10),
          })
          await seedSession(ctx, bId, unitId, { date: testDate(-10), endTime: '17:00' })
        }
      })

      const result = await t.mutation(internal.bookings.status.completeBookings, {})
      expect(result).toEqual({ completed: 100, more: false })

      // No continuation scheduled — all bookings already processed
      const remaining = await t.run(async (ctx) =>
        ctx.db.query('bookings').withIndex('by_status', (q) => q.eq('status', 'Upcoming')).collect(),
      )
      expect(remaining).toHaveLength(0)
    })

    it('processes all 150 bookings across multiple continuation runs', async () => {
      vi.useFakeTimers()

      const t = makeT()

      await t.run(async (ctx) => {
        const unitId = await seedUnit(ctx)
        for (let i = 0; i < 150; i++) {
          const bId = await seedBooking(ctx, {
            startDate: testDate(-10),
            endDate: testDate(-10),
          })
          await seedSession(ctx, bId, unitId, { date: testDate(-10), endTime: '17:00' })
        }
      })

      // Use monitored wrapper which handles continuation scheduling (DD-158)
      await t.mutation(internal.bookings.status.completeBookingsWithMonitoring, {})
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const completed = await t.run(async (ctx) =>
        ctx.db.query('bookings').withIndex('by_status', (q) => q.eq('status', 'Completed')).collect(),
      )
      expect(completed).toHaveLength(150)

      const upcoming = await t.run(async (ctx) =>
        ctx.db.query('bookings').withIndex('by_status', (q) => q.eq('status', 'Upcoming')).collect(),
      )
      expect(upcoming).toHaveLength(0)

      vi.useRealTimers()
    })

    it('only completes Upcoming bookings — Draft bookings do not count toward batch', async () => {
      const t = makeT()

      await t.run(async (ctx) => {
        const unitId = await seedUnit(ctx)
        // 51 Upcoming bookings with past sessions
        for (let i = 0; i < 51; i++) {
          const bId = await seedBooking(ctx, {
            startDate: testDate(-10),
            endDate: testDate(-10),
          })
          await seedSession(ctx, bId, unitId, { date: testDate(-10), endTime: '17:00' })
        }
        // 50 Draft bookings with past sessions — should be ignored
        for (let i = 0; i < 50; i++) {
          const bId = await seedBooking(ctx, {
            status: 'Draft',
            startDate: testDate(-10),
            endDate: testDate(-10),
          })
          await seedSession(ctx, bId, unitId, { date: testDate(-10), endTime: '17:00' })
        }
      })

      const result = await t.mutation(internal.bookings.status.completeBookings, {})
      // Only 51 Upcoming, all fit in one batch, no continuation needed
      expect(result).toEqual({ completed: 51, more: false })

      const drafts = await t.run(async (ctx) =>
        ctx.db.query('bookings').withIndex('by_status', (q) => q.eq('status', 'Draft')).collect(),
      )
      expect(drafts).toHaveLength(50)
    })

    it('no further scheduler calls after all bookings are completed', async () => {
      vi.useFakeTimers()

      const t = makeT()

      await t.run(async (ctx) => {
        const unitId = await seedUnit(ctx)
        for (let i = 0; i < 101; i++) {
          const bId = await seedBooking(ctx, {
            startDate: testDate(-10),
            endDate: testDate(-10),
          })
          await seedSession(ctx, bId, unitId, { date: testDate(-10), endTime: '17:00' })
        }
      })

      await t.mutation(internal.bookings.status.completeBookingsWithMonitoring, {})
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // After completion, calling again should find nothing
      const finalResult = await t.mutation(internal.bookings.status.completeBookings, {})
      expect(finalResult).toEqual({ completed: 0, more: false })

      vi.useRealTimers()
    })
  })
})
