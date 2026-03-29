/**
 * DD-256: purgeExpiredDrafts cron — behavioral tests
 *
 * Covers:
 * - Expired Draft bookings are cancelled with reservations vacated
 * - Availability snapshots are restored after purge
 * - Non-expired Drafts are untouched
 * - Non-Draft expired bookings are untouched
 * - Audit log entry created for each purged draft
 */

import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import { testDate } from './helpers/dates'
import {
  seedUser,
  seedBooking,
  seedSession,
  seedReservation,
  seedInventoryUnit,
  seedSnapshot,
  TEST_SLUGS,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

describe('purgeExpiredDrafts', () => {
  it('cancels an expired Draft and vacates its reservations', async () => {
    const t = makeT()

    const { bookingId, reservationId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      return { bookingId, reservationId, snapshotId }
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')

    const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(reservation?.status).toBe('Vacated')
    expect(reservation?.vacatedBy).toBe('hold_expired')

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot?.availableUnits).toBe(1)
    expect(snapshot?.reservedUnits).toBe(0)
  })

  it('writes audit log entry with expired_draft_purged action', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const auditEntries = await t.run(async (ctx) =>
      ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId_timestamp', (q) => q.eq('bookingId', bookingId))
        .collect(),
    )
    expect(auditEntries).toHaveLength(1)
    expect(auditEntries[0].action).toBe('expired_draft_purged')
    expect(auditEntries[0].actorSlug).toBe('system')
    expect(auditEntries[0].actorType).toBe('system')
  })

  it('does not touch a Draft with future expiresAt', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        expiresAt: Date.now() + 3_600_000,
        status: 'Draft',
      })
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')
  })

  it('does not touch a non-Draft booking with past expiresAt', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Upcoming',
      })
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Upcoming')
  })

  it('restores availability snapshot capacity after purge', async () => {
    const t = makeT()

    const { snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 4,
        reservedUnits: 2,
        availableUnits: 2,
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Confirmed',
        unitsRequested: 2,
      })
      return { snapshotId }
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot?.availableUnits).toBe(4)
    expect(snapshot?.reservedUnits).toBe(0)
  })

  it('does not touch a Draft without expiresAt', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, { status: 'Draft' })
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')
  })

  it('returns the count of purged bookings', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      // Two expired drafts
      await seedBooking(ctx, { expiresAt: Date.now() - 60_000, status: 'Draft' })
      await seedBooking(ctx, { expiresAt: Date.now() - 120_000, status: 'Draft' })
      // One non-expired draft
      await seedBooking(ctx, { expiresAt: Date.now() + 3_600_000, status: 'Draft' })
    })

    const result = await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 2 })
  })
})
