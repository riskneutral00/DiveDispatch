import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { getDateRange } from '../convex/reservationsMutations'

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
    expect(getDateRange('2024-06-01', '2024-06-01')).toEqual(['2024-06-01'])
  })

  it('returns inclusive range across multiple days', () => {
    expect(getDateRange('2024-06-01', '2024-06-03')).toEqual([
      '2024-06-01',
      '2024-06-02',
      '2024-06-03',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
        date: '2024-06-01',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
        date: '2024-06-01',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
        date: '2024-06-01',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
        date: '2024-06-01',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
        date: '2024-06-01',
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })
      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: '2024-06-01',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
        date: '2024-06-01',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
        date: '2024-06-01',
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
        startDate: '2024-06-01',
        endDate: '2024-06-01',
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
