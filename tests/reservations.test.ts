import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { getDateRange } from '../convex/reservationsMutations'
import { MAX_RESERVATIONS_PER_BOOKING } from '../convex/bookings/inventoryRelease'
import { testDate } from './helpers/dates'
import { ErrorCode } from '../convex/lib/errorCodes'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import {
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedSession,
  seedReservation,
  seedSnapshot,
  seedBookingResource,
  type SeedCtx,
} from './fixtures'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seed a standard instructor + DC + unit + booking + session + reservation + bookingResource setup */
async function seedAcceptScenario(
  ctx: SeedCtx,
  opts: {
    instrToken?: string
    instrSlug?: string
    dcToken?: string
    dcSlug?: string
    instrName?: string
    dcName?: string
    instrBusiness?: string
    dcBusiness?: string
    resStatus?: Doc<'reservations'>['status']
    confirmedAt?: number
    bookingStatus?: Doc<'bookings'>['status']
    startDate?: string
    endDate?: string
    divers?: Doc<'bookings'>['divers']
    bookingFormComplete?: boolean
    customerFormComplete?: boolean
  } = {},
) {
  const instrToken = opts.instrToken ?? 'user|123'
  const instrSlug = opts.instrSlug ?? 'instructor-slug'
  const dcToken = opts.dcToken ?? 'user|dc'
  const dcSlug = opts.dcSlug ?? 'dc-slug'
  const startDate = opts.startDate ?? testDate(5)
  const endDate = opts.endDate ?? opts.startDate ?? testDate(5)

  await seedUser(ctx, {
    tokenIdentifier: instrToken,
    slug: instrSlug,
    email: `${instrSlug}@test.com`,
    name: opts.instrName ?? 'Instructor',
    firstName: opts.instrName?.split(' ')[0] ?? 'John',
    lastName: opts.instrName?.split(' ')[1] ?? 'Doe',
    businessName: opts.instrBusiness ?? 'Instructor Co',
    role: 'Instructor',
  })
  await seedUser(ctx, {
    tokenIdentifier: dcToken,
    slug: dcSlug,
    email: `${dcSlug}@test.com`,
    name: opts.dcName ?? 'DC',
    firstName: opts.dcName?.split(' ')[0] ?? 'DC',
    lastName: opts.dcName?.split(' ')[1] ?? 'Test',
    businessName: opts.dcBusiness ?? 'Test DC',
    role: 'DiveCenter',
  })
  const unitId = await seedInventoryUnit(ctx, {
    resourceType: 'Instructor',
    displayName: opts.instrName ?? 'John Doe',
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId: instrSlug,
    ownerType: 'Instructor',
  })
  const bookingId = await seedBooking(ctx, {
    ownerId: dcSlug,
    status: opts.bookingStatus ?? 'Draft',
    startDate,
    endDate,
    divers: opts.divers ?? [],
    operatorName: opts.dcBusiness ?? 'Test DC',
    bookingFormComplete: opts.bookingFormComplete ?? true,
    customerFormComplete: opts.customerFormComplete ?? true,
  })
  await seedBookingResource(ctx, bookingId, {
    resourceType: 'Instructor',
    resourceSlug: instrSlug,
  })
  const sessionId = await seedSession(ctx, bookingId, unitId, {
    date: startDate,
    startTime: '08:00',
    endTime: '16:00',
  })
  const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
    status: opts.resStatus ?? 'PendingAcceptance',
    ...(opts.confirmedAt !== undefined ? { } : {}),
  })
  // patch confirmedAt if needed (seedReservation doesn't support it)
  if (opts.confirmedAt !== undefined) {
    await ctx.db.patch(resId, { confirmedAt: opts.confirmedAt } as never)
  }
  return { unitId, bookingId, sessionId, resId, instrSlug, instrToken, dcSlug, dcToken }
}

// ─── getDateRange ─────────────────────────────────────────────────────────────

describe('getDateRange', () => {
  it('returns single date when start equals end', () => {
    expect(getDateRange(testDate(5), testDate(5))).toEqual([testDate(5)])
  })

  it('returns inclusive range across multiple days', () => {
    expect(getDateRange(testDate(5), testDate(7))).toEqual([
      testDate(5),
      testDate(6),
      testDate(7),
    ])
  })
})

// ─── acceptReservation ────────────────────────────────────────────────────────

describe('acceptReservation', () => {
  it('transitions PendingAcceptance to Confirmed and sets confirmedAt', async () => {
    const t = makeT()

    const { resId } = await t.run(async (ctx) => {
      return seedAcceptScenario(ctx)
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.acceptReservation,
      { reservationId: resId },
    )

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(res?.status).toBe('Confirmed')
      expect(res?.confirmedAt).toEqual(expect.any(Number))

      // H15: audit log entry
      const logs = await ctx.db.query('bookingAuditLog').collect()
      expect(logs).toContainEqual(expect.objectContaining({
        action: 'reservation_accepted',
        actorType: 'resource',
      }))
    })
  })

  it('is idempotent: double-accept does not change confirmedAt', async () => {
    const t = makeT()

    const { resId } = await t.run(async (ctx) => {
      return seedAcceptScenario(ctx, { resStatus: 'Confirmed', confirmedAt: Date.now() - 5000 })
    })

    // Second accept on already-Confirmed reservation should be a no-op
    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.acceptReservation,
      { reservationId: resId },
    )

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(res?.status).toBe('Confirmed')
    })
  })

  it('throws FORBIDDEN when caller does not own the inventory unit', async () => {
    const t = makeT()

    const { resId } = await t.run(async (ctx) => {
      // Caller is "other-slug", not the unit owner
      await seedUser(ctx, {
        tokenIdentifier: 'user|456',
        slug: 'other-slug',
        email: 'other@test.com',
        name: 'Other',
        firstName: 'Other',
        lastName: 'User',
        businessName: 'Other Co',
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug', // owned by instructor-slug, not other-slug
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId)
      return { resId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'user|456' }).mutation(
        api.reservationsMutations.acceptReservation,
        { reservationId: resId },
      ),
      'FORBIDDEN',
    )
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const t = makeT()

    const { resId } = await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId)
      return { resId }
    })

    await expectConvexError(
      t.mutation(api.reservationsMutations.acceptReservation, { reservationId: resId }),
      'UNAUTHENTICATED',
    )
  })
})

// ─── declineReservation ───────────────────────────────────────────────────────

describe('declineReservation', () => {
  it('vacates the reservation with stakeholder_declined and restores the snapshot', async () => {
    const t = makeT()

    const { resId, snapshotId, bookingId, unitId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx)
      const snapshotId = await seedSnapshot(ctx, s.unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { resId: s.resId, snapshotId, bookingId: s.bookingId, unitId: s.unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(res?.status).toBe('Vacated')
      expect(res?.vacatedBy).toBe('stakeholder_declined')
      expect(res?.vacatedAt).toEqual(expect.any(Number))

      // unitsRequested=1 returned to snapshot (0 → 1 available, 1 → 0 reserved)
      const snap = await ctx.db.get(snapshotId)
      expect(snap?.availableUnits).toBe(1)
      expect(snap?.reservedUnits).toBe(0)

      // H15: audit log entry
      const logs = await ctx.db.query('bookingAuditLog').collect()
      expect(logs).toContainEqual(expect.objectContaining({
        action: 'reservation_declined',
        actorType: 'resource',
      }))
    })
  })

  it('sends hold_declined notification to the booking owner', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx)
      await seedSnapshot(ctx, s.unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId: s.bookingId, unitId: s.unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const holdDeclined = notifications.find((n) => n.type === 'hold_declined')
      expect(holdDeclined).toMatchObject({
        type: 'hold_declined',
        userId: 'dc-slug',
        bookingId,
      })
      expect(holdDeclined?.message).toContain('declined')
    })
  })

  it('sends no_backup_available when no alternative units exist', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx)
      await seedSnapshot(ctx, s.unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId: s.bookingId, unitId: s.unitId }
      // No other inventoryUnits seeded — no alternatives
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toMatchObject({
        type: 'no_backup_available',
        userId: 'dc-slug',
        bookingId,
      })
    })
  })

  it('throws FORBIDDEN when caller does not own the inventory unit', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      // Caller: other-slug (does NOT own the unit)
      await seedUser(ctx, {
        tokenIdentifier: 'user|456',
        slug: 'other-slug',
        email: 'other@test.com',
        name: 'Other',
        firstName: 'Other',
        lastName: 'User',
        businessName: 'Other Co',
        role: 'Instructor',
      })
      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instructor-slug', // owned by instructor-slug, not other-slug
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
      })
      return { bookingId, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'user|456' }).mutation(
        api.reservationsMutations.declineReservation,
        { bookingId, inventoryUnitId: unitId },
      ),
      'FORBIDDEN',
    )
  })

  it('H26: skips no_backup_available when an alternative unit has availability on all booking dates', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      // DC + declining instructor
      await seedUser(ctx, {
        tokenIdentifier: 'user|h26-inst',
        slug: 'h26-instructor',
        email: 'h26@test.com',
        name: 'H26 Instructor',
        firstName: 'H26',
        lastName: 'Instructor',
        businessName: 'H26 Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|h26-dc',
        slug: 'h26-dc',
        email: 'h26dc@test.com',
        name: 'H26 DC',
        firstName: 'H26',
        lastName: 'DC',
        businessName: 'H26 DC Co',
        role: 'DiveCenter',
      })

      // Declining unit
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'H26 Instructor',
        ownerId: 'h26-instructor',
        ownerType: 'Instructor',
      })

      // Alternative unit (same resource type, different owner)
      await seedUser(ctx, {
        tokenIdentifier: 'user|h26-alt',
        slug: 'h26-alt-instructor',
        email: 'h26alt@test.com',
        name: 'Alt Instructor',
        firstName: 'Alt',
        lastName: 'Instructor',
        businessName: 'Alt Co',
        role: 'Instructor',
      })
      const altUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Alt Instructor',
        ownerId: 'h26-alt-instructor',
        ownerType: 'Instructor',
      })

      // Multi-day booking (3 days)
      const bookingId = await seedBooking(ctx, {
        ownerId: 'h26-dc',
        startDate: testDate(5),
        endDate: testDate(7),
        operatorName: 'H26 DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'h26-instructor',
      })

      // Sessions + reservations + snapshots for the declining unit (3 days)
      for (let day = 5; day <= 7; day++) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
        })
        await seedSnapshot(ctx, unitId, {
          date: testDate(day),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 1,
          reservedUnits: 1,
          availableUnits: 0,
        })
        await seedReservation(ctx, bookingId, unitId, sessionId)
      }

      // Alternative unit has availability on ALL 3 booking dates
      for (let day = 5; day <= 7; day++) {
        await seedSnapshot(ctx, altUnitId, {
          date: testDate(day),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 1,
          reservedUnits: 0,
          availableUnits: 1,
        })
      }

      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|h26-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    // Alternative exists → should NOT send no_backup_available
    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toBeUndefined()

      // But hold_declined notification should still be sent
      const holdDeclined = notifications.find((n) => n.type === 'hold_declined')
      expect(holdDeclined).toMatchObject({
        type: 'hold_declined',
        bookingId,
      })
    })
  })

  it('H26: sends no_backup_available when alternative lacks availability on one of the booking dates', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|h26b-inst',
        slug: 'h26b-instructor',
        email: 'h26b@test.com',
        name: 'H26b Instructor',
        firstName: 'H26b',
        lastName: 'Instructor',
        businessName: 'H26b Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|h26b-dc',
        slug: 'h26b-dc',
        email: 'h26bdc@test.com',
        name: 'H26b DC',
        firstName: 'H26b',
        lastName: 'DC',
        businessName: 'H26b DC Co',
        role: 'DiveCenter',
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'H26b Instructor',
        ownerId: 'h26b-instructor',
        ownerType: 'Instructor',
      })

      // Alternative unit — available on day 5 and 6, but NOT day 7
      await seedUser(ctx, {
        tokenIdentifier: 'user|h26b-alt',
        slug: 'h26b-alt-instructor',
        email: 'h26balt@test.com',
        name: 'Alt2 Instructor',
        firstName: 'Alt2',
        lastName: 'Instructor',
        businessName: 'Alt2 Co',
        role: 'Instructor',
      })
      const altUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Alt2 Instructor',
        ownerId: 'h26b-alt-instructor',
        ownerType: 'Instructor',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'h26b-dc',
        startDate: testDate(5),
        endDate: testDate(7),
        operatorName: 'H26b DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'h26b-instructor',
      })

      for (let day = 5; day <= 7; day++) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
        })
        await seedSnapshot(ctx, unitId, {
          date: testDate(day),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 1,
          reservedUnits: 1,
          availableUnits: 0,
        })
        await seedReservation(ctx, bookingId, unitId, sessionId)
      }

      // Alt available on days 5-6, fully booked on day 7
      for (let day = 5; day <= 6; day++) {
        await seedSnapshot(ctx, altUnitId, {
          date: testDate(day),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 1,
          reservedUnits: 0,
          availableUnits: 1,
        })
      }
      await seedSnapshot(ctx, altUnitId, {
        date: testDate(7),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|h26b-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    // No alternative covers all dates → should send no_backup_available
    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toMatchObject({
        type: 'no_backup_available',
        userId: 'h26b-dc',
        bookingId,
      })
    })
  })

  it('DD-390: truncation at MAX_RESERVATIONS_PER_BOOKING hides alt-instructor beyond position 500 (bounded fetch)', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|dd390-inst',
        slug: 'dd390-instructor',
        email: 'dd390@test.com',
        name: 'DD390 Instructor',
        firstName: 'DD390',
        lastName: 'Instructor',
        businessName: 'DD390 Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|dd390-dc',
        slug: 'dd390-dc',
        email: 'dd390dc@test.com',
        name: 'DD390 DC',
        firstName: 'DD390',
        lastName: 'DC',
        businessName: 'DD390 DC Co',
        role: 'DiveCenter',
      })
      // Neutral owner for noise units — must NOT be dd390-instructor to avoid
      // cross-contamination in candidate filtering.
      await seedUser(ctx, {
        tokenIdentifier: 'user|dd390-noise',
        slug: 'dd390-noise-owner',
        email: 'dd390noise@test.com',
        name: 'DD390 Noise',
        firstName: 'DD390',
        lastName: 'Noise',
        businessName: 'DD390 Noise Co',
        role: 'DiveCenter',
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'DD390 Instructor',
        ownerId: 'dd390-instructor',
        ownerType: 'Instructor',
      })

      // Alternative instructor with available capacity on the booking date
      await seedUser(ctx, {
        tokenIdentifier: 'user|dd390-alt',
        slug: 'dd390-alt-instructor',
        email: 'dd390alt@test.com',
        name: 'DD390 Alt',
        firstName: 'DD390',
        lastName: 'Alt',
        businessName: 'DD390 Alt Co',
        role: 'Instructor',
      })
      const altUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'DD390 Alt Instructor',
        ownerId: 'dd390-alt-instructor',
        ownerType: 'Instructor',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dd390-dc',
        startDate: testDate(5),
        endDate: testDate(5),
        operatorName: 'DD390 DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'dd390-instructor',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
      })
      // Position 1: declined instructor's snapshot (fully reserved)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      await seedReservation(ctx, bookingId, unitId, sessionId)

      // Positions 2–501: 500 noise snapshots from distinct Boat units with neutral owner.
      // This fills the .take(MAX_RESERVATIONS_PER_BOOKING) buffer completely.
      for (let i = 0; i < MAX_RESERVATIONS_PER_BOOKING; i++) {
        const noiseUnitId = await seedInventoryUnit(ctx, {
          resourceType: 'Boat',
          displayName: `Noise Boat ${i}`,
          ownerId: 'dd390-noise-owner',
          ownerType: 'Boat',
        })
        await seedSnapshot(ctx, noiseUnitId, {
          date: testDate(5),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 5,
          reservedUnits: 2,
          availableUnits: 3,
        })
      }

      // Position 502: alt-instructor snapshot — inserted last, falls beyond .take(500).
      // This is the candidate that SHOULD be found but gets silently dropped by truncation.
      await seedSnapshot(ctx, altUnitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })

      return { bookingId, unitId, altUnitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|dd390-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    // Known limitation: .take(MAX_RESERVATIONS_PER_BOOKING) truncates the by_date scan,
    // so the alt-instructor snapshot at position 502 is never seen.
    // The system fires no_backup_available even though a valid alternative exists.
    // This test documents the silent-drop behavior.
    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toMatchObject({
        type: 'no_backup_available',
        bookingId,
      })

      const holdDeclined = notifications.find((n) => n.type === 'hold_declined')
      expect(holdDeclined).toMatchObject({ type: 'hold_declined', bookingId })
    })
  })
})

// ─── acceptBookingReservations (bulk accept) ─────────────────────────────────

describe('acceptBookingReservations', () => {
  it('bulk accept: confirms ALL days of a multi-day booking in one call', async () => {
    const t = makeT()

    const { bookingId, unitId, resIds } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|bulk-inst',
        slug: 'bulk-instructor',
        email: 'bulk@test.com',
        name: 'Bulk Instructor',
        firstName: 'Bulk',
        lastName: 'Instructor',
        businessName: 'Bulk Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|dc-bulk',
        slug: 'dc-bulk',
        email: 'dc-bulk@test.com',
        name: 'DC Bulk',
        firstName: 'DC',
        lastName: 'Bulk',
        businessName: 'Bulk DC',
        role: 'DiveCenter',
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Bulk Instructor',
        ownerId: 'bulk-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-bulk',
        startDate: testDate(5),
        endDate: testDate(7),
        operatorName: 'Bulk DC',
        customerFormComplete: true,
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'bulk-instructor',
      })

      // 3-day booking: day 5, 6, 7
      const resIds: string[] = []
      for (let day = 5; day <= 7; day++) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
        })
        const resId = await seedReservation(ctx, bookingId, unitId, sessionId)
        resIds.push(resId)
      }
      return { bookingId, unitId, resIds }
    })

    // Single bulk accept call
    await t.withIdentity({ tokenIdentifier: 'user|bulk-inst' }).mutation(
      api.reservationsMutations.acceptBookingReservations,
      { bookingId, inventoryUnitId: unitId },
    )

    // All 3 reservations confirmed
    await t.run(async (ctx) => {
      for (const resId of resIds) {
        const res = await ctx.db.get(resId as Id<'reservations'>)
        expect(res?.status).toBe('Confirmed')
        expect(res?.confirmedAt).toEqual(expect.any(Number))
      }

      // Booking should auto-advance to Upcoming (all conditions met)
      const booking = await ctx.db.get(bookingId) as Doc<'bookings'> | null
      expect(booking?.status).toBe('Upcoming')
    })
  })

  it('bulk accept: only confirms reservations for the given inventoryUnit, not other units', async () => {
    const t = makeT()

    const { bookingId, unitId, otherUnitId, resForUnit, resForOther } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|selective-inst',
        slug: 'selective-instructor',
        email: 'selective@test.com',
        name: 'Selective Instructor',
        firstName: 'Selective',
        lastName: 'Instructor',
        businessName: 'Selective Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|dc-selective',
        slug: 'dc-selective',
        email: 'dc-selective@test.com',
        name: 'DC Selective',
        firstName: 'DC',
        lastName: 'Selective',
        businessName: 'Selective DC',
        role: 'DiveCenter',
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Selective Instructor',
        ownerId: 'selective-instructor',
        ownerType: 'Instructor',
      })
      const otherUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Other Instructor',
        ownerId: 'other-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-selective',
        operatorName: 'Selective DC',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'selective-instructor',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)
      const otherSessionId = await seedSession(ctx, bookingId, otherUnitId)
      const resForUnit = await seedReservation(ctx, bookingId, unitId, sessionId)
      const resForOther = await seedReservation(ctx, bookingId, otherUnitId, otherSessionId)
      return { bookingId, unitId, otherUnitId, resForUnit, resForOther }
    })

    await t.withIdentity({ tokenIdentifier: 'user|selective-inst' }).mutation(
      api.reservationsMutations.acceptBookingReservations,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const targeted = await ctx.db.get(resForUnit) as Doc<'reservations'> | null
      expect(targeted?.status).toBe('Confirmed')

      const untouched = await ctx.db.get(resForOther) as Doc<'reservations'> | null
      expect(untouched?.status).toBe('PendingAcceptance')
    })
  })

  it('bulk accept: throws INVARIANT_VIOLATION when reservations exceed MAX_RESERVATIONS_PER_BOOKING', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|overflow-inst',
        slug: 'overflow-instructor',
        email: 'overflow@test.com',
        name: 'Overflow Instructor',
        firstName: 'Overflow',
        lastName: 'Instructor',
        businessName: 'Overflow Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|dc-overflow',
        slug: 'dc-overflow',
        email: 'dc-overflow@test.com',
        name: 'DC Overflow',
        firstName: 'DC',
        lastName: 'Overflow',
        businessName: 'Overflow DC',
        role: 'DiveCenter',
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Overflow Instructor',
        ownerId: 'overflow-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-overflow',
        operatorName: 'Overflow DC',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'overflow-instructor',
      })

      // Seed MAX_RESERVATIONS_PER_BOOKING + 1 reservations to trigger the limit
      for (let i = 0; i <= MAX_RESERVATIONS_PER_BOOKING; i++) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date: testDate(5),
          startTime: `${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
          endTime: `${String(Math.floor(i / 60)).padStart(2, '0')}:${String((i % 60) + 1).padStart(2, '0')}`,
        })
        await seedReservation(ctx, bookingId, unitId, sessionId)
      }
      return { bookingId, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'user|overflow-inst' }).mutation(
        api.reservationsMutations.acceptBookingReservations,
        { bookingId, inventoryUnitId: unitId },
      ),
      ErrorCode.INVARIANT_VIOLATION,
    )
  })

  it('accept idempotency: accepting already-Confirmed reservations is a no-op, no error', async () => {
    const t = makeT()

    const { bookingId, unitId, confirmedAt } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|idem-inst',
        slug: 'idem-instructor',
        email: 'idem@test.com',
        name: 'Idem Instructor',
        firstName: 'Idem',
        lastName: 'Instructor',
        businessName: 'Idem Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|dc-idem',
        slug: 'dc-idem',
        email: 'dc-idem@test.com',
        name: 'DC Idem',
        firstName: 'DC',
        lastName: 'Idem',
        businessName: 'Idem DC',
        role: 'DiveCenter',
      })
      const unitId = await seedInventoryUnit(ctx, {
        displayName: 'Idem Instructor',
        ownerId: 'idem-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-idem',
        startDate: testDate(5),
        endDate: testDate(6),
        operatorName: 'Idem DC',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'idem-instructor',
      })

      // Both reservations already Confirmed
      const confirmedAt = Date.now() - 10000
      for (let day = 5; day <= 6; day++) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
        })
        const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
          status: 'Confirmed',
        })
        await ctx.db.patch(resId, { confirmedAt } as never)
      }
      return { bookingId, unitId, confirmedAt }
    })

    // Second call should not throw — idempotent
    await t.withIdentity({ tokenIdentifier: 'user|idem-inst' }).mutation(
      api.reservationsMutations.acceptBookingReservations,
      { bookingId, inventoryUnitId: unitId },
    )

    // Reservations still Confirmed, no state change
    await t.run(async (ctx) => {
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingId))
        .collect()

      expect(reservations).toHaveLength(2)
      for (const res of reservations) {
        expect(res.status).toBe('Confirmed')
      }
    })
  })
})

// ─── decline cascade side effects ─────────────────────────────────────────────

describe('decline cascade side effects', () => {
  // ── H17: Snapshot restoration ──────────────────────────────────────────────

  it('H17: exclusive unit decline increments availableUnits and decrements reservedUnits by unitsRequested', async () => {
    const t = makeT()

    const { bookingId, unitId, snapshotId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx, {
        instrToken: 'user|snap-inst',
        instrSlug: 'snap-instructor',
        instrName: 'Snap Instructor',
        instrBusiness: 'Snap Co',
        dcToken: 'user|snap-dc',
        dcSlug: 'snap-dc',
        dcName: 'Snap DC',
        dcBusiness: 'Snap DC Co',
      })
      // Snapshot starts fully reserved: availableUnits=0, reservedUnits=1
      const snapshotId = await seedSnapshot(ctx, s.unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      return { bookingId: s.bookingId, unitId: s.unitId, snapshotId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|snap-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const snap = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'> | null
      // unitsRequested=1 restored: availableUnits 0→1, reservedUnits 1→0
      expect(snap?.availableUnits).toBe(1)
      expect(snap?.reservedUnits).toBe(0)
    })
  })

  it('H17: multi-day decline restores ALL date snapshots, not just the first', async () => {
    const t = makeT()

    const { bookingId, unitId, snapshotIds } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|multiday-inst',
        slug: 'multiday-instructor',
        email: 'multiday@test.com',
        name: 'Multiday Instructor',
        firstName: 'Multiday',
        lastName: 'Instructor',
        businessName: 'Multiday Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|multiday-dc',
        slug: 'multiday-dc',
        email: 'multiday-dc@test.com',
        name: 'Multiday DC',
        firstName: 'Multiday',
        lastName: 'DC',
        businessName: 'Multiday DC Co',
        role: 'DiveCenter',
      })
      const unitId = await seedInventoryUnit(ctx, {
        displayName: 'Multiday Instructor',
        ownerId: 'multiday-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'multiday-dc',
        startDate: testDate(5),
        endDate: testDate(7),
        operatorName: 'Multiday DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'multiday-instructor',
      })

      // 3 sessions across 3 days, each with their own snapshot fully reserved
      const snapshotIds: string[] = []
      for (let day = 5; day <= 7; day++) {
        const sessionId = await seedSession(ctx, bookingId, unitId, {
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
        })
        const snapshotId = await seedSnapshot(ctx, unitId, {
          date: testDate(day),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 1,
          availableUnits: 0,
          reservedUnits: 1,
        })
        snapshotIds.push(snapshotId)
        await seedReservation(ctx, bookingId, unitId, sessionId)
      }
      return { bookingId, unitId, snapshotIds }
    })

    await t.withIdentity({ tokenIdentifier: 'user|multiday-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      for (const snapshotId of snapshotIds) {
        const snap = await ctx.db.get(snapshotId as Id<'availabilitySnapshots'>)
        expect(snap?.availableUnits).toBe(1)
        expect(snap?.reservedUnits).toBe(0)
      }
    })
  })

  it('DD-295: decline with 2 reservations on the same pooled snapshot aggregates and restores both units', async () => {
    const t = makeT()

    const { bookingId, unitId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|dw-inst',
        slug: 'dw-instructor',
        email: 'dw@test.com',
        name: 'DW Instructor',
        firstName: 'DW',
        lastName: 'Instructor',
        businessName: 'DW Co',
        role: 'Instructor',
      })
      await seedUser(ctx, {
        tokenIdentifier: 'user|dw-dc',
        slug: 'dw-dc',
        email: 'dw-dc@test.com',
        name: 'DW DC',
        firstName: 'DW',
        lastName: 'DC',
        businessName: 'DW DC Co',
        role: 'DiveCenter',
      })
      const unitId = await seedInventoryUnit(ctx, {
        displayName: 'Pooled Tank Rack',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'dw-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dw-dc',
        startDate: testDate(5),
        endDate: testDate(5),
        operatorName: 'DW DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'dw-instructor',
      })
      // One session, one snapshot, TWO reservations on the same session+snapshot
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
      })
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 10,
        availableUnits: 8,
        reservedUnits: 2,
      })
      // Two reservations against the same snapshot (pooled: 1 unit each)
      await seedReservation(ctx, bookingId, unitId, sessionId, { unitsRequested: 1 })
      await seedReservation(ctx, bookingId, unitId, sessionId, { unitsRequested: 1 })

      return { bookingId, unitId, snapshotId }
    })

    // Decline should succeed — aggregating 2 units and restoring the snapshot once
    await t.withIdentity({ tokenIdentifier: 'user|dw-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    // Verify: both reservations vacated, snapshot restored by 2 units total
    await t.run(async (ctx) => {
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId_inventoryUnitId', (q) =>
          q.eq('bookingId', bookingId as Id<'bookings'>).eq('inventoryUnitId', unitId as Id<'inventoryUnits'>),
        )
        .collect()

      expect(reservations).toHaveLength(2)
      expect(reservations[0].status).toBe('Vacated')
      expect(reservations[1].status).toBe('Vacated')

      const snapshot = await ctx.db.get(snapshotId as Id<'availabilitySnapshots'>)
      expect(snapshot!.availableUnits).toBe(10) // 8 + 2 restored
      expect(snapshot!.reservedUnits).toBe(0)   // 2 - 2 restored
    })
  })

  it('H17: decline deletes the bookingResources junction row for the declined resource type', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx, {
        instrToken: 'user|junc-inst',
        instrSlug: 'junc-instructor',
        instrName: 'Junction Instructor',
        instrBusiness: 'Junction Co',
        dcToken: 'user|junc-dc',
        dcSlug: 'junc-dc',
        dcName: 'Junction DC',
        dcBusiness: 'Junction DC Co',
      })
      await seedSnapshot(ctx, s.unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      return { bookingId: s.bookingId, unitId: s.unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|junc-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query('bookingResources')
        .withIndex('by_bookingId', (q: any) => q.eq('bookingId', bookingId))
        .collect()
      // The Instructor junction row must be gone after decline
      const instructorRow = rows.find((r) => r.resourceType === 'Instructor')
      expect(instructorRow).toBeUndefined()
    })
  })

  it('H17: decline on Upcoming booking reverts status to Draft, clears bookingFormComplete, sets expiresAt', async () => {
    const t = makeT()

    const beforeDecline = Date.now()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx, {
        instrToken: 'user|upcoming-inst',
        instrSlug: 'upcoming-instructor',
        instrName: 'Upcoming Instructor',
        instrBusiness: 'Upcoming Co',
        dcToken: 'user|upcoming-dc',
        dcSlug: 'upcoming-dc',
        dcName: 'Upcoming DC',
        dcBusiness: 'Upcoming DC Co',
        bookingStatus: 'Upcoming',
        resStatus: 'Confirmed',
        confirmedAt: Date.now() - 60000,
      })
      await seedSnapshot(ctx, s.unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      return { bookingId: s.bookingId, unitId: s.unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|upcoming-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId) as Doc<'bookings'> | null
      expect(booking?.status).toBe('Draft')
      expect(booking?.bookingFormComplete).toBe(false)
      // expiresAt must be set to a future timestamp (now + holdTTL)
      expect(booking?.expiresAt).toEqual(expect.any(Number))
      expect(booking?.expiresAt).toBeGreaterThan(beforeDecline)
    })
  })

  // ── H20: Notification content assertions ───────────────────────────────────

  it('H20: hold_declined notification has correct type, recipient, bookingId, and message contains unit displayName', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx, {
        instrToken: 'user|notif-inst',
        instrSlug: 'notif-instructor',
        instrName: 'Marie Curie',
        instrBusiness: 'Notif Co',
        dcToken: 'user|notif-dc',
        dcSlug: 'notif-dc',
        dcName: 'Notif DC',
        dcBusiness: 'Notif DC Co',
      })
      await seedSnapshot(ctx, s.unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      return { bookingId: s.bookingId, unitId: s.unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|notif-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const declined = notifications.find((n) => n.type === 'hold_declined') as Doc<'notifications'> | undefined

      // Recipient must be the booking owner (DiveCenter), NOT the resource stakeholder
      expect(declined).toMatchObject({
        type: 'hold_declined',
        userId: 'notif-dc',
        bookingId,
      })
      // Message must contain the unit's displayName so the operator knows who declined
      expect(declined?.message).toContain('Marie Curie')
    })
  })

  it('H20: noshow_marked notification has correct type, recipient (resource stakeholder), and bookingId', async () => {
    const t = makeT()

    const { resId, bookingId, unitId } = await t.run(async (ctx) => {
      const s = await seedAcceptScenario(ctx, {
        instrToken: 'user|ns-inst',
        instrSlug: 'ns-instructor',
        instrName: 'NS Instructor',
        instrBusiness: 'NS Co',
        dcToken: 'user|ns-dc',
        dcSlug: 'ns-dc',
        dcName: 'NS DC',
        dcBusiness: 'NS DC Co',
        bookingStatus: 'Upcoming',
        // Session date in the past so hasSessionStarted returns true
        startDate: testDate(-2),
        endDate: testDate(-2),
        resStatus: 'Confirmed',
        confirmedAt: Date.now() - 100000,
      })
      return { resId: s.resId, bookingId: s.bookingId, unitId: s.unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|ns-dc' }).mutation(
      api.reservationsMutations.markNoShow,
      { reservationId: resId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noshow = notifications.find((n) => n.type === 'noshow_marked') as Doc<'notifications'> | undefined

      // Recipient must be the resource stakeholder (Instructor), NOT the booking owner
      expect(noshow).toMatchObject({
        type: 'noshow_marked',
        userId: 'ns-instructor',
        bookingId,
      })
    })
  })
})

// ─── H19: Multi-reservation release atomicity ─────────────────────────────

describe('H19 — releaseBookingReservations with 3+ reservations', () => {
  it('vacates all 3 active reservations and restores all 3 snapshots', async () => {
    const t = makeT()

    const ids = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-h19', tokenIdentifier: 'clerk|dc-h19', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-h19', status: 'Draft' })

      // 3 different units on 3 different dates
      const units = await Promise.all([
        seedInventoryUnit(ctx, { resourceType: 'Instructor', displayName: 'Unit A' }),
        seedInventoryUnit(ctx, { resourceType: 'Boat', capacityModel: 'Pooled', totalUnits: 10, displayName: 'Unit B' }),
        seedInventoryUnit(ctx, { resourceType: 'Equipment', capacityModel: 'Pooled', totalUnits: 5, displayName: 'Unit C' }),
      ])

      const dates = [testDate(10), testDate(11), testDate(12)]
      const sessions: Awaited<ReturnType<typeof seedSession>>[] = []
      const snapshots: Awaited<ReturnType<typeof seedSnapshot>>[] = []
      const reservations: Awaited<ReturnType<typeof seedReservation>>[] = []

      for (let i = 0; i < 3; i++) {
        const sid = await seedSession(ctx, bookingId, units[i], { date: dates[i] })
        const snapId = await seedSnapshot(ctx, units[i], {
          date: dates[i],
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: i === 0 ? 1 : i === 1 ? 10 : 5,
          reservedUnits: 1,
          availableUnits: i === 0 ? 0 : i === 1 ? 9 : 4,
        })
        const resId = await seedReservation(ctx, bookingId, units[i], sid, {
          status: i === 0 ? 'PendingAcceptance' : 'Confirmed',
        })
        sessions.push(sid)
        snapshots.push(snapId)
        reservations.push(resId)
      }

      return { bookingId, reservations, snapshots }
    })

    // Cancel the booking — should release all 3 reservations
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-h19' }).mutation(
      api.bookingDraftMutations.discardDraft,
      { bookingId: ids.bookingId },
    )

    await t.run(async (ctx) => {
      // All 3 snapshots restored
      for (const snapId of ids.snapshots) {
        const snap = await ctx.db.get(snapId)
        // reservedUnits should be decremented by 1 (each reservation held 1 unit)
        expect(snap?.reservedUnits).toBe(0)
      }
    })
  })

  it('skips already-Vacated reservations, only vacates active ones', async () => {
    const t = makeT()

    const ids = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-mix', tokenIdentifier: 'clerk|dc-mix', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-mix', status: 'Draft' })

      const unit1 = await seedInventoryUnit(ctx, { displayName: 'Active Unit' })
      const unit2 = await seedInventoryUnit(ctx, { displayName: 'Vacated Unit' })

      const s1 = await seedSession(ctx, bookingId, unit1, { date: testDate(10) })
      const s2 = await seedSession(ctx, bookingId, unit2, { date: testDate(11) })

      const snap1 = await seedSnapshot(ctx, unit1, {
        date: testDate(10), windowStart: '08:00', windowEnd: '16:00',
        totalUnits: 1, reservedUnits: 1, availableUnits: 0,
      })
      // Unit 2 snapshot already restored (vacated previously)
      const snap2 = await seedSnapshot(ctx, unit2, {
        date: testDate(11), windowStart: '08:00', windowEnd: '16:00',
        totalUnits: 1, reservedUnits: 0, availableUnits: 1,
      })

      const res1 = await seedReservation(ctx, bookingId, unit1, s1, { status: 'Confirmed' })
      const res2 = await seedReservation(ctx, bookingId, unit2, s2, { status: 'Vacated' })

      return { bookingId, res1, res2, snap1, snap2 }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-mix' }).mutation(
      api.bookingDraftMutations.discardDraft,
      { bookingId: ids.bookingId },
    )

    await t.run(async (ctx) => {
      // Active unit's snapshot restored
      const snap1 = await ctx.db.get(ids.snap1)
      expect(snap1?.availableUnits).toBe(1)
      expect(snap1?.reservedUnits).toBe(0)

      // Already-Vacated unit's snapshot unchanged
      const snap2 = await ctx.db.get(ids.snap2)
      expect(snap2?.availableUnits).toBe(1)
      expect(snap2?.reservedUnits).toBe(0)
    })
  })
})
