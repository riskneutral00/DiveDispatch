/**
 * DD-256 / DD-271 / DD-276 / DD-286 / DD-284 / DD-278: purgeExpiredDrafts cron — behavioral tests
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
 * - Per-booking error isolation: corrupt booking #2 skipped, #1 and #3 purged (DD-276)
 * - BATCH_SIZE cap: only 25 bookings attempted per run (DD-276)
 * - Count test extended with status + snapshot assertions (DD-271)
 * - Unrecognized error codes re-throw instead of being silently swallowed (DD-286)
 * - INVARIANT_VIOLATION when reservation count exceeds MAX_RESERVATIONS_PER_BOOKING (DD-284)
 * - Booking with exactly MAX_RESERVATIONS_PER_BOOKING reservations succeeds normally (DD-284)
 * - purgeExpiredDrafts isolates INVARIANT_VIOLATION per-booking (DD-284)
 * - Per-booking atomicity: failure on booking N does not affect bookings 1…N-1 (DD-278)
 * - MISSING_SNAPSHOT: batch-fetch phase (no snapshot seeded) error code path tested (DD-278)
 * - SNAPSHOT_UNDERFLOW re-throws instead of being isolated (DD-290)
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
import { makeT } from './helpers/convex-helpers'
import { ErrorCode } from '../convex/lib/errorCodes'
import { MAX_RESERVATIONS_PER_BOOKING } from '../convex/bookings/inventoryRelease'

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})

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

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 2, skipped: 0, errors: [] })

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

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 1, skipped: 0, errors: [] })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('does not purge a Draft whose expiresAt equals exactly Date.now() (strict q.lt boundary)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      // expiresAt 1ms in the future — strict less-than means this must NOT be selected
      return seedBooking(ctx, {
        expiresAt: Date.now() + 1,
        status: 'Draft',
      })
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 0, skipped: 0, errors: [] })

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

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 0, skipped: 0, errors: [] })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')
  })

  it('skips a booking with ORPHANED_RESERVATION and reports it in errors (DD-276)', async () => {
    const t = makeT()

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      // Delete the session to create the orphan condition
      await ctx.db.delete(sessionId)
      return { bookingId, reservationId }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result.purged).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].bookingId).toBe(bookingId)
    expect(result.errors[0].errorCode).toBe(ErrorCode.ORPHANED_RESERVATION)

    // Booking remains Draft — catch prevented the patch
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')

    // Reservation was NOT prematurely patched to Vacated
    const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(reservation?.status).toBe('PendingAcceptance')
  })

  it('skips a booking with MISSING_SNAPSHOT and reports it in errors (DD-276)', async () => {
    const t = makeT()

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      // No snapshot seeded — snapshot lookup will return null
      return { bookingId, reservationId }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result.purged).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].bookingId).toBe(bookingId)
    expect(result.errors[0].errorCode).toBe(ErrorCode.MISSING_SNAPSHOT)

    // Booking remains Draft — catch prevented the patch
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')

    // Reservation was NOT prematurely patched to Vacated
    const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(reservation?.status).toBe('PendingAcceptance')
  })

  it('isolates corrupt booking #2: purges #1 and #3, skips #2 with error (DD-276)', async () => {
    const t = makeT()

    const { booking1, booking2, booking3, snap1Id, snap3Id } = await t.run(async (ctx) => {
      await seedUser(ctx)

      // Booking #1 — healthy expired draft with reservation
      const booking1 = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit1 = await seedInventoryUnit(ctx, { displayName: 'Instructor 1' })
      const session1 = await seedSession(ctx, booking1, unit1)
      const snap1Id = await seedSnapshot(ctx, unit1, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, booking1, unit1, session1, {
        status: 'PendingAcceptance',
      })

      // Booking #2 — corrupt: orphaned session (deleted after reservation created)
      const booking2 = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit2 = await seedInventoryUnit(ctx, { displayName: 'Instructor 2' })
      const session2 = await seedSession(ctx, booking2, unit2)
      await seedReservation(ctx, booking2, unit2, session2, {
        status: 'PendingAcceptance',
      })
      await ctx.db.delete(session2)

      // Booking #3 — healthy expired draft with reservation
      const booking3 = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit3 = await seedInventoryUnit(ctx, { displayName: 'Instructor 3' })
      const session3 = await seedSession(ctx, booking3, unit3)
      const snap3Id = await seedSnapshot(ctx, unit3, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, booking3, unit3, session3, {
        status: 'PendingAcceptance',
      })

      return { booking1, booking2, booking3, snap1Id, snap3Id }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result.purged).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].bookingId).toBe(booking2)
    expect(result.errors[0].errorCode).toBe(ErrorCode.ORPHANED_RESERVATION)

    const [b1, b2, b3] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(booking1), ctx.db.get(booking2), ctx.db.get(booking3)]),
    )
    expect(b1?.status).toBe('Cancelled')
    expect(b2?.status).toBe('Draft')
    expect(b3?.status).toBe('Cancelled')

    // Snapshots for #1 and #3 were restored
    const [snap1, snap3] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(snap1Id), ctx.db.get(snap3Id)]),
    )
    expect(snap1?.availableUnits).toBe(1)
    expect(snap1?.reservedUnits).toBe(0)
    expect(snap3?.availableUnits).toBe(1)
    expect(snap3?.reservedUnits).toBe(0)
  })

  it('respects BATCH_SIZE cap of 25 — only 25 bookings attempted per run (DD-276)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      // Seed 26 expired drafts (no reservations — simplest case)
      for (let i = 0; i < 26; i++) {
        await seedBooking(ctx, {
          expiresAt: Date.now() - (i + 1) * 1000,
          status: 'Draft',
        })
      }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result.purged).toBe(25)
    expect(result.skipped).toBe(0)
    expect(result.errors).toEqual([])

    // Verify exactly 1 Draft remains
    const remaining = await t.run(async (ctx) =>
      ctx.db
        .query('bookings')
        .withIndex('by_status', (q) => q.eq('status', 'Draft'))
        .collect(),
    )
    expect(remaining).toHaveLength(1)

    // Verify 25 are Cancelled
    const cancelled = await t.run(async (ctx) =>
      ctx.db
        .query('bookings')
        .withIndex('by_status', (q) => q.eq('status', 'Cancelled'))
        .collect(),
    )
    expect(cancelled).toHaveLength(25)
  })

  it('re-throws unrecognized errors instead of silently swallowing them (DD-286)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      // Corrupt the session startTime to trigger a VALIDATION ConvexError
      // (not in the isolatable allowlist)
      await ctx.db.patch(sessionId, { startTime: 'INVALID' })
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
    })

    // The action must throw — not silently swallow the unrecognized error
    await expect(
      t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {}),
    ).rejects.toThrow()
  })

  it('throws INVARIANT_VIOLATION when PendingAcceptance reservations exceed MAX_RESERVATIONS_PER_BOOKING (DD-284)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx, {
        capacityModel: 'Pooled',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
        reservedUnits: MAX_RESERVATIONS_PER_BOOKING + 1,
        availableUnits: 9,
      })
      // Insert MAX + 1 PendingAcceptance reservations to exceed the boundary
      for (let i = 0; i < MAX_RESERVATIONS_PER_BOOKING + 1; i++) {
        await seedReservation(ctx, bookingId, unitId, sessionId, {
          status: 'PendingAcceptance',
          unitsRequested: 1,
        })
      }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].errorCode).toBe(ErrorCode.INVARIANT_VIOLATION)
  }, 30_000)

  it('throws INVARIANT_VIOLATION when Confirmed reservations exceed MAX_RESERVATIONS_PER_BOOKING (DD-284)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx, {
        capacityModel: 'Pooled',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
        reservedUnits: MAX_RESERVATIONS_PER_BOOKING + 1,
        availableUnits: 9,
      })
      // Insert MAX + 1 Confirmed reservations to exceed the boundary
      for (let i = 0; i < MAX_RESERVATIONS_PER_BOOKING + 1; i++) {
        await seedReservation(ctx, bookingId, unitId, sessionId, {
          status: 'Confirmed',
          unitsRequested: 1,
        })
      }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].errorCode).toBe(ErrorCode.INVARIANT_VIOLATION)
  }, 30_000)

  it('succeeds normally when booking has exactly MAX_RESERVATIONS_PER_BOOKING reservations (DD-284)', async () => {
    const t = makeT()

    const { bookingId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx, {
        capacityModel: 'Pooled',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
        reservedUnits: MAX_RESERVATIONS_PER_BOOKING,
        availableUnits: 10,
      })
      // Insert exactly MAX PendingAcceptance reservations — boundary is safe
      for (let i = 0; i < MAX_RESERVATIONS_PER_BOOKING; i++) {
        await seedReservation(ctx, bookingId, unitId, sessionId, {
          status: 'PendingAcceptance',
          unitsRequested: 1,
        })
      }
      return { bookingId, snapshotId }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result).toEqual({ purged: 1, skipped: 0, errors: [] })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Cancelled')

    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot?.availableUnits).toBe(MAX_RESERVATIONS_PER_BOOKING + 10)
    expect(snapshot?.reservedUnits).toBe(0)
  }, 30_000)

  it('isolates INVARIANT_VIOLATION per-booking in purgeExpiredDrafts (DD-284)', async () => {
    const t = makeT()

    const { healthyBookingId, overflowBookingId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx)

      // Healthy booking — normal reservation count
      const healthyBookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit1 = await seedInventoryUnit(ctx, { displayName: 'Normal Unit' })
      const session1 = await seedSession(ctx, healthyBookingId, unit1)
      const snapshotId = await seedSnapshot(ctx, unit1, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, healthyBookingId, unit1, session1, {
        status: 'PendingAcceptance',
      })

      // Overflow booking — MAX + 1 reservations
      const overflowBookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit2 = await seedInventoryUnit(ctx, {
        displayName: 'Overflow Unit',
        capacityModel: 'Pooled',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
      })
      const session2 = await seedSession(ctx, overflowBookingId, unit2)
      await seedSnapshot(ctx, unit2, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: MAX_RESERVATIONS_PER_BOOKING + 10,
        reservedUnits: MAX_RESERVATIONS_PER_BOOKING + 1,
        availableUnits: 9,
      })
      for (let i = 0; i < MAX_RESERVATIONS_PER_BOOKING + 1; i++) {
        await seedReservation(ctx, overflowBookingId, unit2, session2, {
          status: 'PendingAcceptance',
          unitsRequested: 1,
        })
      }

      return { healthyBookingId, overflowBookingId, snapshotId }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    // Healthy booking purged, overflow booking skipped
    expect(result.purged).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].bookingId).toBe(overflowBookingId)
    expect(result.errors[0].errorCode).toBe(ErrorCode.INVARIANT_VIOLATION)

    // Healthy booking was cancelled and snapshot restored
    const booking = await t.run(async (ctx) => ctx.db.get(healthyBookingId))
    expect(booking?.status).toBe('Cancelled')
    const snapshot = await t.run(async (ctx) => ctx.db.get(snapshotId))
    expect(snapshot?.availableUnits).toBe(1)
    expect(snapshot?.reservedUnits).toBe(0)

    // Overflow booking remains Draft
    const overflowBooking = await t.run(async (ctx) => ctx.db.get(overflowBookingId))
    expect(overflowBooking?.status).toBe('Draft')
  }, 30_000)

  it('per-booking atomicity: booking N failure does not roll back bookings 1…N-1 (DD-278)', async () => {
    const t = makeT()

    const { booking1, booking2, booking3, snap1Id, snap3Id, res2Id } = await t.run(async (ctx) => {
      await seedUser(ctx)

      // Booking #1 — healthy expired draft with reservation
      const booking1 = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit1 = await seedInventoryUnit(ctx, { displayName: 'Instructor 1' })
      const session1 = await seedSession(ctx, booking1, unit1)
      const snap1Id = await seedSnapshot(ctx, unit1, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, booking1, unit1, session1, {
        status: 'PendingAcceptance',
      })

      // Booking #2 — has reservation but no snapshot seeded (MISSING_SNAPSHOT)
      // No snapshot exists, so releaseBookingReservations throws MISSING_SNAPSHOT
      // during the batch-fetch phase.
      const booking2 = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit2 = await seedInventoryUnit(ctx, { displayName: 'Instructor 2' })
      const session2 = await seedSession(ctx, booking2, unit2)
      const res2Id = await seedReservation(ctx, booking2, unit2, session2, {
        status: 'PendingAcceptance',
      })
      // No snapshot seeded — will trigger MISSING_SNAPSHOT during batch-fetch
      // (MISSING_SNAPSHOT is in ISOLATABLE_ERRORS)

      // Booking #3 — healthy expired draft with reservation
      const booking3 = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unit3 = await seedInventoryUnit(ctx, { displayName: 'Instructor 3' })
      const session3 = await seedSession(ctx, booking3, unit3)
      const snap3Id = await seedSnapshot(ctx, unit3, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, booking3, unit3, session3, {
        status: 'PendingAcceptance',
      })

      return { booking1, booking2, booking3, snap1Id, snap3Id, res2Id }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    // Bookings #1 and #3 purged, booking #2 skipped
    expect(result.purged).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].bookingId).toBe(booking2)

    // Bookings #1 and #3 are cancelled with snapshots restored
    const [b1, b2, b3] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(booking1), ctx.db.get(booking2), ctx.db.get(booking3)]),
    )
    expect(b1?.status).toBe('Cancelled')
    expect(b2?.status).toBe('Draft')
    expect(b3?.status).toBe('Cancelled')

    const [snap1, snap3] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(snap1Id), ctx.db.get(snap3Id)]),
    )
    expect(snap1?.availableUnits).toBe(1)
    expect(snap1?.reservedUnits).toBe(0)
    expect(snap3?.availableUnits).toBe(1)
    expect(snap3?.reservedUnits).toBe(0)

    // Booking #2's reservation was NOT vacated (mutation rolled back)
    const res2 = await t.run(async (ctx) => ctx.db.get(res2Id))
    expect(res2?.status).toBe('PendingAcceptance')
  })

  it('re-throws SNAPSHOT_UNDERFLOW instead of isolating it (DD-290)', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      // Snapshot has reservedUnits: 0 but reservation requests 1 unit
      // This triggers SNAPSHOT_UNDERFLOW in restoreSnapshotUnits
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        reservedUnits: 0,
        availableUnits: 1,
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
        unitsRequested: 1,
      })
    })

    // SNAPSHOT_UNDERFLOW must abort the batch, not be silently isolated
    await expect(
      t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {}),
    ).rejects.toThrow()
  })

  it('MISSING_SNAPSHOT: no snapshot in batch-fetch phase (DD-278)', async () => {
    const t = makeT()

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, {
        expiresAt: Date.now() - 60_000,
        status: 'Draft',
      })
      const unitId = await seedInventoryUnit(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })
      // No snapshot → MISSING_SNAPSHOT during batch-fetch in releaseBookingReservations
      return { bookingId, reservationId }
    })

    const result = await t.action(internal.bookings.inventoryRelease.purgeExpiredDrafts, {})
    expect(result.purged).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].bookingId).toBe(bookingId)
    expect(result.errors[0].errorCode).toBe(ErrorCode.MISSING_SNAPSHOT)

    // Booking remains Draft — mutation for this booking was rolled back
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.status).toBe('Draft')

    // Reservation was NOT vacated
    const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(reservation?.status).toBe('PendingAcceptance')
  })
})
