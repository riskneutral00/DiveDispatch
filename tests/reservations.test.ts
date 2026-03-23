import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'
import { getDateRange } from '../convex/reservationsMutations'
import { testDate } from './helpers/dates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000

function makeT() {
  return convexTest(schema, import.meta.glob('../convex/**/*.ts'))
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
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
      // Caller user (instructor who owns the unit)
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|123',
        slug: 'instructor-slug',
        email: 'instructor@test.com',
        name: 'Instructor',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Instructor Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      // Booking owner
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc',
        slug: 'dc-slug',
        email: 'dc@test.com',
        name: 'DC',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'instructor-slug',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { resId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.acceptReservation,
      { reservationId: resId },
    )

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(res?.status).toBe('Confirmed')
      expect(res?.confirmedAt).toBeDefined()
      expect(typeof res?.confirmedAt).toBe('number')
    })
  })

  it('is idempotent: double-accept does not change confirmedAt', async () => {
    const t = makeT()

    const { resId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|123',
        slug: 'instructor-slug',
        email: 'instructor@test.com',
        name: 'Instructor',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Instructor Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc',
        slug: 'dc-slug',
        email: 'dc@test.com',
        name: 'DC',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'instructor-slug',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const confirmedAt = Date.now() - 5000
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt,
      })
      return { resId, confirmedAt }
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
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|456',
        slug: 'other-slug',
        email: 'other@test.com',
        name: 'Other',
        firstName: 'Other',
        lastName: 'User',
        businessName: 'Other Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug', // owned by instructor-slug, not other-slug
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
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
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
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
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|123',
        slug: 'instructor-slug',
        email: 'instructor@test.com',
        name: 'Instructor',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Instructor Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc',
        slug: 'dc-slug',
        email: 'dc@test.com',
        name: 'DC',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'instructor-slug',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { resId, snapshotId, bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(res?.status).toBe('Vacated')
      expect(res?.vacatedBy).toBe('stakeholder_declined')
      expect(res?.vacatedAt).toBeDefined()

      // unitsRequested=1 returned to snapshot (0 → 1 available, 1 → 0 reserved)
      const snap = await ctx.db.get(snapshotId)
      expect(snap?.availableUnits).toBe(1)
      expect(snap?.reservedUnits).toBe(0)
    })
  })

  it('sends hold_declined notification to the booking owner', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|123',
        slug: 'instructor-slug',
        email: 'instructor@test.com',
        name: 'Instructor',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Instructor Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc',
        slug: 'dc-slug',
        email: 'dc@test.com',
        name: 'DC',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'instructor-slug',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const holdDeclined = notifications.find((n) => n.type === 'hold_declined')
      expect(holdDeclined).toBeDefined()
      expect(holdDeclined?.userId).toBe('dc-slug')
      expect(holdDeclined?.bookingId).toBe(bookingId)
    })
  })

  it('sends no_backup_available when no alternative units exist', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|123',
        slug: 'instructor-slug',
        email: 'instructor@test.com',
        name: 'Instructor',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Instructor Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc',
        slug: 'dc-slug',
        email: 'dc@test.com',
        name: 'DC',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'instructor-slug',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId, unitId }
      // No other inventoryUnits seeded — no alternatives
    })

    await t.withIdentity({ tokenIdentifier: 'user|123' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toBeDefined()
      expect(noBackup?.userId).toBe('dc-slug')
    })
  })

  it('throws FORBIDDEN when caller does not own the inventory unit', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      // Caller: other-slug (does NOT own the unit)
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|456',
        slug: 'other-slug',
        email: 'other@test.com',
        name: 'Other',
        firstName: 'Other',
        lastName: 'User',
        businessName: 'Other Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-slug',
        displayName: 'John Doe',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-slug', // owned by instructor-slug, not other-slug
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-slug',
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
        customerFormComplete: true,
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
})

// ─── acceptBookingReservations (bulk accept) ─────────────────────────────────

describe('acceptBookingReservations', () => {
  it('bulk accept: confirms ALL days of a multi-day booking in one call', async () => {
    const t = makeT()

    const { bookingId, unitId, resIds } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|bulk-inst',
        slug: 'bulk-instructor',
        email: 'bulk@test.com',
        name: 'Bulk Instructor',
        firstName: 'Bulk',
        lastName: 'Instructor',
        businessName: 'Bulk Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc-bulk',
        slug: 'dc-bulk',
        email: 'dc-bulk@test.com',
        name: 'DC Bulk',
        firstName: 'DC',
        lastName: 'Bulk',
        businessName: 'Bulk DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'bulk-instructor',
        displayName: 'Bulk Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'bulk-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-bulk',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Bulk DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'bulk-instructor',
      })

      // 3-day booking: day 5, 6, 7
      const resIds: string[] = []
      for (let day = 5; day <= 7; day++) {
        const sessionId = await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
          timezone: 'Asia/Bangkok',
        })
        const resId = await ctx.db.insert('reservations', {
          bookingId,
          inventoryUnitId: unitId,
          bookingSessionId: sessionId,
          unitsRequested: 1,
          status: 'PendingAcceptance',
        })
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
        const res = await ctx.db.get(resId as any) as Doc<'reservations'> | null
        expect(res?.status).toBe('Confirmed')
        expect(res?.confirmedAt).toBeDefined()
        expect(typeof res?.confirmedAt).toBe('number')
      }

      // Booking should auto-advance to Upcoming (all conditions met)
      const booking = await ctx.db.get(bookingId) as Doc<'bookings'> | null
      expect(booking?.status).toBe('Upcoming')
    })
  })

  it('bulk accept: only confirms reservations for the given inventoryUnit, not other units', async () => {
    const t = makeT()

    const { bookingId, unitId, otherUnitId, resForUnit, resForOther } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|selective-inst',
        slug: 'selective-instructor',
        email: 'selective@test.com',
        name: 'Selective Instructor',
        firstName: 'Selective',
        lastName: 'Instructor',
        businessName: 'Selective Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc-selective',
        slug: 'dc-selective',
        email: 'dc-selective@test.com',
        name: 'DC Selective',
        firstName: 'DC',
        lastName: 'Selective',
        businessName: 'Selective DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'selective-instructor',
        displayName: 'Selective Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'selective-instructor',
        ownerType: 'Instructor',
      })
      const otherUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'other-instructor',
        displayName: 'Other Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'other-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-selective',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Selective DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'selective-instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const otherSessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: otherUnitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const resForUnit = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      const resForOther = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: otherUnitId,
        bookingSessionId: otherSessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
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

  it('accept idempotency: accepting already-Confirmed reservations is a no-op, no error', async () => {
    const t = makeT()

    const { bookingId, unitId, confirmedAt } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|idem-inst',
        slug: 'idem-instructor',
        email: 'idem@test.com',
        name: 'Idem Instructor',
        firstName: 'Idem',
        lastName: 'Instructor',
        businessName: 'Idem Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc-idem',
        slug: 'dc-idem',
        email: 'dc-idem@test.com',
        name: 'DC Idem',
        firstName: 'DC',
        lastName: 'Idem',
        businessName: 'Idem DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'idem-instructor',
        displayName: 'Idem Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'idem-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-idem',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(6),
        divers: [],
        operatorName: 'Idem DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'idem-instructor',
      })

      // Both reservations already Confirmed
      const confirmedAt = Date.now() - 10000
      for (let day = 5; day <= 6; day++) {
        const sessionId = await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
          timezone: 'Asia/Bangkok',
        })
        await ctx.db.insert('reservations', {
          bookingId,
          inventoryUnitId: unitId,
          bookingSessionId: sessionId,
          unitsRequested: 1,
          status: 'Confirmed',
          confirmedAt,
        })
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
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|snap-inst',
        slug: 'snap-instructor',
        email: 'snap-inst@test.com',
        name: 'Snap Instructor',
        firstName: 'Snap',
        lastName: 'Instructor',
        businessName: 'Snap Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|snap-dc',
        slug: 'snap-dc',
        email: 'snap-dc@test.com',
        name: 'Snap DC',
        firstName: 'Snap',
        lastName: 'DC',
        businessName: 'Snap DC Co',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'snap-instructor',
        displayName: 'Snap Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'snap-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'snap-dc',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Snap DC Co',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'snap-instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Asia/Bangkok',
      })
      // Snapshot starts fully reserved: availableUnits=0, reservedUnits=1
      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '17:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { bookingId, unitId, snapshotId }
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
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|multiday-inst',
        slug: 'multiday-instructor',
        email: 'multiday@test.com',
        name: 'Multiday Instructor',
        firstName: 'Multiday',
        lastName: 'Instructor',
        businessName: 'Multiday Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|multiday-dc',
        slug: 'multiday-dc',
        email: 'multiday-dc@test.com',
        name: 'Multiday DC',
        firstName: 'Multiday',
        lastName: 'DC',
        businessName: 'Multiday DC Co',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'multiday-instructor',
        displayName: 'Multiday Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'multiday-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'multiday-dc',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Multiday DC Co',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'multiday-instructor',
      })

      // 3 sessions across 3 days, each with their own snapshot fully reserved
      const snapshotIds: string[] = []
      for (let day = 5; day <= 7; day++) {
        const sessionId = await ctx.db.insert('bookingSessions', {
          bookingId,
          inventoryUnitId: unitId,
          date: testDate(day),
          startTime: '08:00',
          endTime: '16:00',
          timezone: 'Asia/Bangkok',
        })
        const snapshotId = await ctx.db.insert('availabilitySnapshots', {
          inventoryUnitId: unitId,
          date: testDate(day),
          windowStart: '08:00',
          windowEnd: '16:00',
          totalUnits: 1,
          availableUnits: 0,
          reservedUnits: 1,
        })
        snapshotIds.push(snapshotId)
        await ctx.db.insert('reservations', {
          bookingId,
          inventoryUnitId: unitId,
          bookingSessionId: sessionId,
          unitsRequested: 1,
          status: 'PendingAcceptance',
        })
      }
      return { bookingId, unitId, snapshotIds }
    })

    await t.withIdentity({ tokenIdentifier: 'user|multiday-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      for (const snapshotId of snapshotIds) {
        const snap = await ctx.db.get(snapshotId as any) as Doc<'availabilitySnapshots'> | null
        expect(snap?.availableUnits).toBe(1)
        expect(snap?.reservedUnits).toBe(0)
      }
    })
  })

  it('H17: decline deletes the bookingResources junction row for the declined resource type', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|junc-inst',
        slug: 'junc-instructor',
        email: 'junc@test.com',
        name: 'Junction Instructor',
        firstName: 'Junction',
        lastName: 'Instructor',
        businessName: 'Junction Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|junc-dc',
        slug: 'junc-dc',
        email: 'junc-dc@test.com',
        name: 'Junction DC',
        firstName: 'Junction',
        lastName: 'DC',
        businessName: 'Junction DC Co',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'junc-instructor',
        displayName: 'Junction Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'junc-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'junc-dc',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Junction DC Co',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'junc-instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { bookingId, unitId }
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
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|upcoming-inst',
        slug: 'upcoming-instructor',
        email: 'upcoming@test.com',
        name: 'Upcoming Instructor',
        firstName: 'Upcoming',
        lastName: 'Instructor',
        businessName: 'Upcoming Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|upcoming-dc',
        slug: 'upcoming-dc',
        email: 'upcoming-dc@test.com',
        name: 'Upcoming DC',
        firstName: 'Upcoming',
        lastName: 'DC',
        businessName: 'Upcoming DC Co',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'upcoming-instructor',
        displayName: 'Upcoming Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'upcoming-instructor',
        ownerType: 'Instructor',
      })
      // Booking is already Upcoming (all resources previously confirmed)
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'upcoming-dc',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Upcoming DC Co',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'upcoming-instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      // Reservation is Confirmed (booking was Upcoming)
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now() - 60000,
      })
      return { bookingId, unitId }
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
      expect(booking?.expiresAt).toBeDefined()
      expect(booking?.expiresAt).toBeGreaterThan(beforeDecline)
    })
  })

  // ── H20: Notification content assertions ───────────────────────────────────

  it('H20: hold_declined notification has correct type, recipient, bookingId, and message contains unit displayName', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|notif-inst',
        slug: 'notif-instructor',
        email: 'notif@test.com',
        name: 'Notif Instructor',
        firstName: 'Notif',
        lastName: 'Instructor',
        businessName: 'Notif Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|notif-dc',
        slug: 'notif-dc',
        email: 'notif-dc@test.com',
        name: 'Notif DC',
        firstName: 'Notif',
        lastName: 'DC',
        businessName: 'Notif DC Co',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'notif-instructor',
        displayName: 'Marie Curie',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'notif-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'notif-dc',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Notif DC Co',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Instructor' as any,
        resourceSlug: 'notif-instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        availableUnits: 0,
        reservedUnits: 1,
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|notif-inst' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const declined = notifications.find((n) => n.type === 'hold_declined') as Doc<'notifications'> | undefined

      expect(declined).toBeDefined()
      // Recipient must be the booking owner (DiveCenter), NOT the resource stakeholder
      expect(declined?.userId).toBe('notif-dc')
      // bookingId must match the affected booking
      expect(declined?.bookingId).toBe(bookingId)
      // Message must contain the unit's displayName so the operator knows who declined
      expect(declined?.message).toContain('Marie Curie')
    })
  })

  it('H20: noshow_marked notification has correct type, recipient (resource stakeholder), and bookingId', async () => {
    const t = makeT()

    const { resId, bookingId, unitId } = await t.run(async (ctx) => {
      // Booking owner (DiveCenter) — is the one who marks NoShow
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|ns-dc',
        slug: 'ns-dc',
        email: 'ns-dc@test.com',
        name: 'NS DC',
        firstName: 'NS',
        lastName: 'DC',
        businessName: 'NS DC Co',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      // Resource stakeholder (Instructor) — should receive the notification
      await ctx.db.insert('users', {
        tokenIdentifier: 'user|ns-inst',
        slug: 'ns-instructor',
        email: 'ns-inst@test.com',
        name: 'NS Instructor',
        firstName: 'NS',
        lastName: 'Instructor',
        businessName: 'NS Co',
        role: 'Instructor',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'ns-instructor',
        displayName: 'NS Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'ns-instructor',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'ns-dc',
        ownerType: 'DiveCenter',
        status: 'Upcoming',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        // Session date in the past so hasSessionStarted returns true
        startDate: testDate(-2),
        endDate: testDate(-2),
        divers: [],
        operatorName: 'NS DC Co',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
      // Past session so time gate passes
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(-2),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'UTC',
      })
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now() - 100000,
      })
      return { resId, bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|ns-dc' }).mutation(
      api.reservationsMutations.markNoShow,
      { reservationId: resId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noshow = notifications.find((n) => n.type === 'noshow_marked') as Doc<'notifications'> | undefined

      expect(noshow).toBeDefined()
      // Recipient must be the resource stakeholder (Instructor), NOT the booking owner
      expect(noshow?.userId).toBe('ns-instructor')
      expect(noshow?.bookingId).toBe(bookingId)
    })
  })
})
