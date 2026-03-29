/**
 * DD-256 / DD-271: purgeExpiredDrafts cron — behavioral tests
 *
 * Covers:
 * - Expired Draft bookings are cancelled with reservations vacated
 * - Availability snapshots are restored after purge
 * - Non-expired Drafts are untouched
 * - Non-Draft expired bookings are untouched
 * - Audit log entry created for each purged draft
 * - Draft with zero reservations purges cleanly (DD-271)
 * - Boundary: expiresAt === Date.now() is NOT purged (strict q.lt) (DD-271)
 * - Already-Cancelled booking is not selected by purge query (DD-271)
 * - Error: ORPHANED_RESERVATION when session is missing (DD-271)
 * - Error: MISSING_SNAPSHOT when snapshot is missing (DD-271)
 * - Count test extended with status + snapshot assertions (DD-271)
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
} from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { ErrorCode } from '../convex/lib/errorCodes'

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

  it('restores snapshot capacity when multiple reservations share the same session', async () => {
    const t = makeT()

    const { snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx, {
        capacityModel: 'Pooled',
        totalUnits: 4,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 4,
        reservedUnits: 3,
        availableUnits: 1,
      })
      // Three reservations on the same session/snapshot
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
        unitsRequested: 1,
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Confirmed',
        unitsRequested: 1,
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
        unitsRequested: 1,
      })
      return { snapshotId }
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot?.availableUnits).toBe(4)
    expect(snapshot?.reservedUnits).toBe(0)
  })

  it('restores snapshots for reservations across different sessions', async () => {
    const t = makeT()

    const { snapshotAId, snapshotBId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitA = await seedInventoryUnit(ctx, { displayName: 'Instructor A' })
      const unitB = await seedInventoryUnit(ctx, { displayName: 'Instructor B' })
      const sessionA = await seedSession(ctx, bookingId, unitA, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '12:00',
      })
      const sessionB = await seedSession(ctx, bookingId, unitB, {
        date: testDate(6),
        startTime: '09:00',
        endTime: '17:00',
      })
      const snapshotAId = await seedSnapshot(ctx, unitA, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '12:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      const snapshotBId = await seedSnapshot(ctx, unitB, {
        date: testDate(6),
        windowStart: '09:00',
        windowEnd: '17:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, bookingId, unitA, sessionA, {
        status: 'PendingAcceptance',
      })
      await seedReservation(ctx, bookingId, unitB, sessionB, {
        status: 'Confirmed',
      })
      return { snapshotAId, snapshotBId }
    })

    await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

    const [snapA, snapB] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(snapshotAId), ctx.db.get(snapshotBId)]),
    )
    expect(snapA?.availableUnits).toBe(1)
    expect(snapA?.reservedUnits).toBe(0)
    expect(snapB?.availableUnits).toBe(1)
    expect(snapB?.reservedUnits).toBe(0)
  })

  it('returns the count of purged bookings and transitions status to Cancelled', async () => {
    const t = makeT()

    const { bookingA, bookingB, bookingC, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      // Two expired drafts — one with a reservation+snapshot
      const bookingA = await seedBooking(ctx, { expiresAt: Date.now() - 60_000, status: 'Draft' })
      const bookingB = await seedBooking(ctx, { expiresAt: Date.now() - 120_000, status: 'Draft' })
      // One non-expired draft
      const bookingC = await seedBooking(ctx, { expiresAt: Date.now() + 3_600_000, status: 'Draft' })

      // Give bookingA a reservation so we can assert snapshot restoration
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingA, unitId)
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, bookingA, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      return { bookingA, bookingB, bookingC, snapshotId }
    })

    const result = await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 2 })

    const [bA, bB, bC, snapshot] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(bookingA),
        ctx.db.get(bookingB),
        ctx.db.get(bookingC),
        ctx.db.get(snapshotId),
      ]),
    )
    expect(bA?.status).toBe('Cancelled')
    expect(bB?.status).toBe('Cancelled')
    expect(bC?.status).toBe('Draft')
    expect(snapshot?.availableUnits).toBe(1)
    expect(snapshot?.reservedUnits).toBe(0)
  })

  it('purges an expired Draft with zero reservations without error', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
    })

    const result = await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 1 })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('does not purge a Draft whose expiresAt equals exactly Date.now() (strict q.lt boundary)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      // expiresAt === now — strict less-than means this must NOT be selected
      return seedBooking(ctx, {
        expiresAt: Date.now(),
        status: 'Draft',
      })
    })

    const result = await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 0 })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')
  })

  it('does not select an already-Cancelled booking for purge', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Cancelled',
      })
    })

    const result = await t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 0 })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('throws ORPHANED_RESERVATION when a reservation references a missing session', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      // Delete the session to create the orphan condition
      await ctx.db.delete(sessionId)
    })

    await expectConvexError(
      t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {}),
      ErrorCode.ORPHANED_RESERVATION,
    )
  })

  it('throws MISSING_SNAPSHOT when a reservation has no matching availability snapshot', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      // No snapshot seeded — snapshot lookup will return null
    })

    await expectConvexError(
      t.mutation(internal.bookings.inventoryRelease.purgeExpiredDrafts, {}),
      ErrorCode.MISSING_SNAPSHOT,
    )
  })
})
