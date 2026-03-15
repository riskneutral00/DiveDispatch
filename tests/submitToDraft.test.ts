import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import {
  releaseBookingReservations,
  tryAutoAdvance,
} from '../convex/bookings/_shared'

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitToDraft', () => {
  it('1 — single booking: creates reservation + snapshot (Exclusive)', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
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
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(1)
      expect(reservations[0].status).toBe('PendingAcceptance')
      expect(reservations[0].unitsRequested).toBe(1)

      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].availableUnits).toBe(0)
      expect(snapshots[0].reservedUnits).toBe(1)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.bookingFormComplete).toBe(true)
      expect(booking?.expiresAt).toBeGreaterThan(Date.now())
    })
  })

  it('2 — Invariant 1: CONFLICT when Exclusive unit is already fully held', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
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
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: '2025-06-15',
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: '2025-06-15',
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })

  it('3 — Invariant 2: CONFLICT when Pooled unit lacks sufficient capacity', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Boat unit',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })
      // 3 available, requesting 4
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: '2025-06-15',
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 10,
        reservedUnits: 7,
        availableUnits: 3,
      })
      return { bookingId, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: '2025-06-15',
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 4,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })

  it('4 — Pooled success at boundary: fills exactly remaining capacity', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Boat unit',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: '2025-06-15',
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 5,
        reservedUnits: 0,
        availableUnits: 5,
      })
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 5,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots[0].availableUnits).toBe(0)
      expect(snapshots[0].reservedUnits).toBe(5)
    })
  })

  it('5 — mixed resources: creates reservation + snapshot for each resource type', async () => {
    const t = makeT()

    const { bookingId, exclusiveId, pooledId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const exclusiveId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })
      const pooledId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Boat unit',
        capacityModel: 'Pooled',
        totalUnits: 20,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })
      return { bookingId, exclusiveId, pooledId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: exclusiveId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
          {
            inventoryUnitId: pooledId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 4,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      expect(await ctx.db.query('reservations').collect()).toHaveLength(2)

      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(2)

      const exclSnap = snapshots.find((s) => s.inventoryUnitId === exclusiveId)
      const poolSnap = snapshots.find((s) => s.inventoryUnitId === pooledId)
      expect(exclSnap?.availableUnits).toBe(0)
      expect(poolSnap?.availableUnits).toBe(16)
    })
  })

  it('6 — UNAUTHENTICATED when identity is missing', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
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
      return { bookingId, unitId }
    })

    // No identity — mutation called without withIdentity
    await expectConvexError(
      t.mutation(api.bookings.create.submitToDraft, {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      }),
      'UNAUTHENTICATED',
    )
  })

  it('7 — BLOCKED_DATE when session date is in user blockedDates', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
        blockedDates: ['2025-06-15'],
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
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
      return { bookingId, unitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: '2025-06-15',
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'BLOCKED_DATE',
    )
  })

  it('8 — edit mode: vacates old reservations + restores snapshots before re-hold', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
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
      return { bookingId, unitId }
    })

    // First submission — hold on 2025-06-15
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const snap = await ctx.db.query('availabilitySnapshots').collect()
      expect(snap[0].availableUnits).toBe(0)
    })

    // Second submission (edit) — hold on 2025-06-16 instead
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: '2025-06-16',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      const vacated = reservations.filter((r) => r.status === 'Vacated')
      const active = reservations.filter((r) => r.status === 'PendingAcceptance')

      expect(vacated).toHaveLength(1)
      expect(vacated[0].vacatedBy).toBe('operator_edit')
      expect(active).toHaveLength(1)

      // Original 2025-06-15 snapshot should be restored to availableUnits=1
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const originalSnap = snapshots.find(
        (s) => s.date === '2025-06-15' && s.inventoryUnitId === unitId,
      )
      expect(originalSnap?.availableUnits).toBe(1)
    })
  })

  it('9 — Auto acceptance mode: reservation created as Confirmed', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-auto',
        displayName: 'Auto instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-auto',
        ownerType: 'Instructor',
      })
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'instructor-auto',
        stakeholderType: 'Instructor',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 8,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: ['en'],
        confirmOnAccept: true,
        confirmOnDecline: true,
      })
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations[0].status).toBe('Confirmed')
      expect(reservations[0].confirmedAt).toBeDefined()
    })
  })

  it('10 — auto-advances to Upcoming when all conditions are satisfied', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: true, // already done
      })
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-autoadvance',
        displayName: 'Auto-advance instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-autoadvance',
        ownerType: 'Instructor',
      })
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'instructor-autoadvance',
        stakeholderType: 'Instructor',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 8,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: ['en'],
        confirmOnAccept: true,
        confirmOnDecline: true,
      })
      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')
    })
  })

  it('11 — all-or-nothing: CONFLICT on any session prevents all writes', async () => {
    const t = makeT()

    const { bookingId, goodUnitId, busyUnitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      const goodUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-good',
        displayName: 'Good boat',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'boat-good',
        ownerType: 'Boat',
      })
      const busyUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-busy',
        displayName: 'Busy instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-busy',
        ownerType: 'Instructor',
      })
      // Exclusive unit already fully held
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: busyUnitId,
        date: '2025-06-15',
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      return { bookingId, goodUnitId, busyUnitId }
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: goodUnitId,
              date: '2025-06-15',
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 4,
            },
            {
              inventoryUnitId: busyUnitId,
              date: '2025-06-15',
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )

    // Zero writes: no reservations, no new snapshot for the good unit
    await t.run(async (ctx) => {
      expect(await ctx.db.query('reservations').collect()).toHaveLength(0)
      const goodUnitSnapshots = (await ctx.db.query('availabilitySnapshots').collect()).filter(
        (s) => s.inventoryUnitId === goodUnitId,
      )
      expect(goodUnitSnapshots).toHaveLength(0)
    })
  })

  it('12 — all-external booking: no reservations created, advances to Upcoming immediately', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: true,
        externalStakeholders: { instructorName: 'Kaptan Ahmet' },
      })
      return { bookingId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      { bookingId, sessions: [] },
    )

    await t.run(async (ctx) => {
      expect(await ctx.db.query('reservations').collect()).toHaveLength(0)
      expect(await ctx.db.query('availabilitySnapshots').collect()).toHaveLength(0)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.bookingFormComplete).toBe(true)
      expect(booking?.status).toBe('Upcoming')
    })
  })

  it('13 — mixed external + in-system: only in-system resource gets reservation', async () => {
    const t = makeT()

    const { bookingId, boatUnitId, instructorUnitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        role: 'DiveCenter',
        isSeeded: false,
        preferredLocale: 'en',
      })
      const boatUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Speedboat',
        capacityModel: 'Pooled',
        totalUnits: 20,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })
      const instructorUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor slot',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: '2025-06-15',
        endDate: '2025-06-17',
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
        boatId: 'boat-1',
        externalStakeholders: { instructorName: 'Kaptan Ahmet' },
      })
      return { bookingId, boatUnitId, instructorUnitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: boatUnitId,
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 4,
          },
          {
            inventoryUnitId: instructorUnitId, // should be skipped (external)
            date: '2025-06-15',
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(1)
      expect(reservations[0].inventoryUnitId).toBe(boatUnitId)

      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].inventoryUnitId).toBe(boatUnitId)
    })
  })
})

// ─── Helper function tests ────────────────────────────────────────────────────

describe('releaseBookingReservations', () => {
  it('vacates active reservations and restores snapshot counts', async () => {
    const t = makeT()

    const { bookingId, resId, snapshotId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
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
      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: '2025-06-15',
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-06-15',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })
      return { bookingId, resId, snapshotId }
    })

    await t.run(async (ctx) => {
      await releaseBookingReservations(ctx, bookingId, 'booking_cancelled')
    })

    await t.run(async (ctx) => {
      const res = await ctx.db.get(resId)
      expect(res?.status).toBe('Vacated')
      expect(res?.vacatedBy).toBe('booking_cancelled')

      const snap = await ctx.db.get(snapshotId)
      expect(snap?.availableUnits).toBe(1)
      expect(snap?.reservedUnits).toBe(0)
    })
  })
})

describe('tryAutoAdvance', () => {
  it('advances to Upcoming when all conditions are met', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
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
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-06-15',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')
    })
  })

  it('stays Draft when customerFormComplete is false', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
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
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-06-15',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')
    })
  })

  it('advances to Upcoming when zero reservations (all-external booking)', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
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
        customerFormComplete: true,
      })
      // No reservations — all resources are external
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')
    })
  })

  it('stays Draft when medical hard block is active', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
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
        medicalHardBlock: true,
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
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: '2025-06-15',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
      return { bookingId }
    })

    await t.run(async (ctx) => {
      await tryAutoAdvance(ctx, bookingId)
    })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')
    })
  })
})
