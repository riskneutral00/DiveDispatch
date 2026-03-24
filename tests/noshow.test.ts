import { describe, it, expect, beforeEach } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { _markNoShowHandler, _revertNoShowHandler } from '../convex/reservationsMutations'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedInventoryUnit,
  seedBooking,
  seedSession,
  seedReservation,
  seedSnapshot,
} from './fixtures/seedFixture'
import { testDate } from './helpers/dates'

const modules = import.meta.glob('../convex/**/*.ts')
let t = convexTest(schema, modules)
beforeEach(() => {
  t = convexTest(schema, modules)
})

// ─── Helper: seed a full booking with Confirmed reservation ──────────────────

async function seedConfirmedBooking(
  ctx: Parameters<typeof seedUser>[0],
  opts: { sessionStartTime?: string; sessionDate?: string } = {},
) {
  const dcId = await seedUser(ctx)
  await seedUser(ctx, {
    tokenIdentifier: TEST_TOKENS.instructor,
    slug: TEST_SLUGS.instructor,
    role: 'Instructor',
  })
  const unitId = await seedInventoryUnit(ctx)
  const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
  const sessionId = await seedSession(ctx, bookingId, unitId, {
    date: opts.sessionDate ?? testDate(0), // today
    startTime: opts.sessionStartTime ?? '08:00',
  })
  const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
    status: 'Confirmed',
  })
  await seedSnapshot(ctx, unitId, {
    date: opts.sessionDate ?? testDate(0),
    reservedUnits: 1,
    availableUnits: 0,
  })
  return { dcId, unitId, bookingId, sessionId, reservationId }
}

// ─── markNoShow ──────────────────────────────────────────────────────────────

describe('markNoShow', () => {
  it('marks Confirmed reservation as NoShow after session start time', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '08:00',
        sessionDate: testDate(0),
      })

      await _markNoShowHandler(ctx, { reservationId: reservationId as string })

      const res = await ctx.db.get(reservationId)
      expect(res!.status).toBe('NoShow')
      expect(res!.noShowAt).toBeTypeOf('number')

      // H15: audit log entry
      const logs = await ctx.db.query('bookingAuditLog').collect()
      expect(logs).toContainEqual(expect.objectContaining({
        action: 'noshow_marked',
        actorSlug: TEST_SLUGS.diveCenter,
        actorType: 'operator',
      }))
    })
  })

  it('rejects NoShow before session start time', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      // Session starts far in the future
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '23:59',
        sessionDate: testDate(5),
      })

      await expect(
        _markNoShowHandler(ctx, { reservationId: reservationId as string }),
      ).rejects.toMatchObject({
        data: { code: 'TOO_EARLY' },
      })
    })
  })

  it('rejects NoShow from PendingAcceptance status', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx)
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(0) })
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
      })

      await expect(
        _markNoShowHandler(ctx, { reservationId: reservationId as string }),
      ).rejects.toMatchObject({
        data: { code: 'INVALID_TRANSITION' },
      })
    })
  })

  it('rejects NoShow from Vacated status', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx)
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(0) })
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Vacated',
      })

      await expect(
        _markNoShowHandler(ctx, { reservationId: reservationId as string }),
      ).rejects.toMatchObject({
        data: { code: 'INVALID_TRANSITION' },
      })
    })
  })

  it('does NOT restore inventory snapshot (capacity stays consumed)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '08:00',
        sessionDate: testDate(0),
      })

      await _markNoShowHandler(ctx, { reservationId: reservationId as string })

      // Snapshot should be unchanged — still 0 available
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots[0].availableUnits).toBe(0)
      expect(snapshots[0].reservedUnits).toBe(1)
    })
  })

  it('sends notification to resource stakeholder', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '08:00',
        sessionDate: testDate(0),
      })

      await _markNoShowHandler(ctx, { reservationId: reservationId as string })

      const notifications = await ctx.db.query('notifications').collect()
      const noShowNotif = notifications.find((n) => n.type === 'noshow_marked')
      expect(noShowNotif).toBeTruthy()
      expect(noShowNotif!.userId).toBe(TEST_SLUGS.instructor)
    })
  })

  it('rejects when caller is not the booking owner', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.other }).run(async (ctx) => {
      // Seed the DC and instructor users
      await seedUser(ctx)
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      // Seed the "other" user who will try to mark NoShow
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.other,
        slug: TEST_SLUGS.other,
        role: 'DiveCenter',
      })
      const unitId = await seedInventoryUnit(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionId = await seedSession(ctx, bookingId, unitId, { date: testDate(0) })
      const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Confirmed',
      })

      await expect(
        _markNoShowHandler(ctx, { reservationId: reservationId as string }),
      ).rejects.toMatchObject({
        data: { code: 'FORBIDDEN' },
      })
    })
  })
})

// ─── revertNoShow ────────────────────────────────────────────────────────────

describe('revertNoShow', () => {
  it('reverts NoShow back to Confirmed within 24h', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '08:00',
        sessionDate: testDate(0),
      })

      // Mark as NoShow first
      await _markNoShowHandler(ctx, { reservationId: reservationId as string })

      // Revert
      await _revertNoShowHandler(ctx, { reservationId: reservationId as string })

      const res = await ctx.db.get(reservationId)
      expect(res!.status).toBe('Confirmed')
      expect(res!.noShowAt).toBeUndefined()

      // H15: audit log entries (mark + revert)
      const logs = await ctx.db.query('bookingAuditLog').collect()
      expect(logs).toContainEqual(expect.objectContaining({
        action: 'noshow_reverted',
        actorSlug: TEST_SLUGS.diveCenter,
        actorType: 'operator',
      }))
    })
  })

  it('rejects revert after 24h', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '08:00',
        sessionDate: testDate(0),
      })

      // Mark as NoShow with a timestamp > 24h ago
      await ctx.db.patch(reservationId, {
        status: 'NoShow',
        noShowAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      })

      await expect(
        _revertNoShowHandler(ctx, { reservationId: reservationId as string }),
      ).rejects.toMatchObject({
        data: { code: 'REVERT_WINDOW_EXPIRED' },
      })
    })
  })

  it('rejects revert from Confirmed status (not NoShow)', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '08:00',
        sessionDate: testDate(0),
      })

      await expect(
        _revertNoShowHandler(ctx, { reservationId: reservationId as string }),
      ).rejects.toMatchObject({
        data: { code: 'INVALID_TRANSITION' },
      })
    })
  })

  it('sends notification to resource stakeholder on revert', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      const { reservationId } = await seedConfirmedBooking(ctx, {
        sessionStartTime: '08:00',
        sessionDate: testDate(0),
      })

      await _markNoShowHandler(ctx, { reservationId: reservationId as string })
      await _revertNoShowHandler(ctx, { reservationId: reservationId as string })

      const notifications = await ctx.db.query('notifications').collect()
      const revertNotif = notifications.find((n) => n.type === 'noshow_reverted')
      expect(revertNotif).toBeTruthy()
      expect(revertNotif!.userId).toBe(TEST_SLUGS.instructor)
    })
  })
})
