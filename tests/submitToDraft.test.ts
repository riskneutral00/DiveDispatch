import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  releaseBookingReservations,
  tryAutoAdvance,
  isFullDayResource,
} from '../convex/bookings/_shared'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { testDate } from './helpers/dates'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { type CourseCode } from '../convex/shared/courseCodes'
import { type BookingRoleType } from '../convex/bookings/stateMachine'

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
        isSeeded: false,
        appLanguage: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|instructor-1',
        slug: 'instructor-1',
        email: 'instructor-1@test.com',
        name: 'Instructor One',
        firstName: 'Instructor',
        lastName: 'One',
        businessName: 'Instructor Biz',
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
            date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
        date: testDate(5),
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
              date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
        date: testDate(5),
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
              date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
        date: testDate(5),
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
            date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
          {
            inventoryUnitId: pooledId,
            date: testDate(5),
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
        startDate: testDate(5),
        endDate: testDate(7),
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
            date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      await ctx.db.insert('stakeholderBlockedDates', {
        stakeholderId: 'dc-test',
        roleType: 'DiveCenter',
        dates: [testDate(5)],
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
              date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|instructor-1',
        slug: 'instructor-1',
        email: 'instructor-1@test.com',
        name: 'Instructor One',
        firstName: 'Instructor',
        lastName: 'One',
        businessName: 'Instructor Biz',
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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

    // First submission — hold on 2030-06-15
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
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

    // Second submission (edit) — hold on 2030-06-16 instead
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(6),
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

      // Original 2030-06-15 snapshot should be restored to availableUnits=1
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      const originalSnap = snapshots.find(
        (s) => s.date === testDate(5) && s.inventoryUnitId === unitId,
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
            date: testDate(5),
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
      expect(typeof reservations[0].confirmedAt).toBe('number')
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
            date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
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
        date: testDate(5),
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
              date: testDate(5),
              startTime: '09:00',
              endTime: '11:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 4,
            },
            {
              inventoryUnitId: busyUnitId,
              date: testDate(5),
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: true,
      })
      return { bookingId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [],
        bookingData: {
          activityType: ['OW'],
          startDate: testDate(5),
          endDate: testDate(7),
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [],
          resources: [{ resourceType: 'Instructor', externalName: 'Kaptan Ahmet' }],
        },
      },
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
        isSeeded: false,
        appLanguage: 'en',
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
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
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
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 4,
          },
          {
            inventoryUnitId: instructorUnitId, // should be skipped (external)
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
        bookingData: {
          activityType: ['OW'],
          startDate: testDate(5),
          endDate: testDate(7),
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [],
          resources: [
            { resourceType: 'Boat', resourceId: 'boat-1' },
            { resourceType: 'Instructor', externalName: 'Kaptan Ahmet' },
          ],
        },
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

  // ─── H6: Mixed Internal + External Resource Tests ──────────────────────────

  it('14 — all-external: zero reservations, zero snapshots, bookingFormComplete = true', async () => {
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
        isSeeded: false,
        appLanguage: 'en',
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      return { bookingId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [],
        bookingData: {
          activityType: ['OW'],
          startDate: testDate(5),
          endDate: testDate(7),
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [],
          resources: [
            { resourceType: 'Instructor', externalName: 'External Instructor' },
            { resourceType: 'Boat', externalName: 'External Boat' },
          ],
        },
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(0)

      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(0)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.bookingFormComplete).toBe(true)
    })
  })

  it('15 — mixed internal + external: 1 reservation (internal), external gets no reservation; junction has 2 rows', async () => {
    const t = makeT()

    const { bookingId, instructorUnitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        isSeeded: false,
        appLanguage: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|instructor-mix',
        slug: 'instructor-mix',
        email: 'instructor-mix@test.com',
        name: 'Instructor Mix',
        firstName: 'Mix',
        lastName: 'Instructor',
        businessName: 'Mix Instructor Co',
        isSeeded: false,
        appLanguage: 'en',
      })
      const instructorUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-mix',
        displayName: 'Internal instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-mix',
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
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
      return { bookingId, instructorUnitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: instructorUnitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
        bookingData: {
          activityType: ['OW'],
          startDate: testDate(5),
          endDate: testDate(7),
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [],
          resources: [
            { resourceType: 'Instructor', resourceId: 'instructor-mix' },
            { resourceType: 'Boat', externalName: 'External Boat' },
          ],
        },
      },
    )

    await t.run(async (ctx) => {
      // Only the internal instructor gets a reservation
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(1)
      expect(reservations[0].inventoryUnitId).toBe(instructorUnitId)

      // Only the internal instructor gets a snapshot
      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].inventoryUnitId).toBe(instructorUnitId)
      expect(snapshots[0].reservedUnits).toBe(1)

      // Junction table has 2 rows: one internal, one external
      const junctionRows = await ctx.db.query('bookingResources').collect()
      expect(junctionRows).toHaveLength(2)

      const internalRow = junctionRows.find((r) => r.resourceId === 'instructor-mix')
      const externalRow = junctionRows.find((r) => r.externalName === 'External Boat')
      expect(internalRow?.resourceType).toBe('Instructor')
      expect(externalRow?.resourceType).toBe('Boat')
    })
  })

  it('16 — external resource does not block auto-advance: mixed booking advances when internal confirms', async () => {
    const t = makeT()

    const { bookingId, instructorUnitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-test',
        slug: 'dc-test',
        email: 'dc@test.com',
        name: 'dc-test',
        firstName: 'DC',
        lastName: 'Test',
        businessName: 'Test DC',
        isSeeded: false,
        appLanguage: 'en',
      })
      const instructorUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-advance',
        displayName: 'Auto-advance instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-advance',
        ownerType: 'Instructor',
      })
      // Auto-accept preference so reservation is immediately Confirmed
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'instructor-advance',
        stakeholderType: 'Instructor',
        acceptanceMode: 'Auto',
        useNamedUnits: false,
        commonLanguageCodes: ['en'],
        confirmOnAccept: true,
        confirmOnDecline: true,
      })
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-test',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: true, // customer form already done
      })
      return { bookingId, instructorUnitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: instructorUnitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
        bookingData: {
          activityType: ['OW'],
          startDate: testDate(5),
          endDate: testDate(7),
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
          divers: [],
          resources: [
            { resourceType: 'Instructor', resourceId: 'instructor-advance' },
            { resourceType: 'Boat', externalName: 'External Boat' },
          ],
        },
      },
    )

    await t.run(async (ctx) => {
      // Internal instructor reservation is auto-confirmed
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(1)
      expect(reservations[0].status).toBe('Confirmed')

      // Booking advanced to Upcoming — external boat did NOT block auto-advance
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')
      expect(booking?.bookingFormComplete).toBe(true)
    })
  })

  it('17 — ratio validation: mixed instructor + DiveMaster resources enforce correct capacity', async () => {
    const t = makeT()

    // 1 Instructor (capacity +4) + 1 DiveMaster (capacity +2) = total 6
    // 7 divers → should reject; 6 divers → should accept

    const { bookingId7, bookingId6 } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-ratio',
        slug: 'dc-ratio',
        email: 'dc-ratio@test.com',
        name: 'dc-ratio',
        firstName: 'DC',
        lastName: 'Ratio',
        businessName: 'Ratio DC',
        isSeeded: false,
        appLanguage: 'en',
      })

      const makeDiver = (name: string, abbrev: string) => ({
        name,
        abbrev,
        flag: { code: 'US', label: 'English' },
        startDate: testDate(5),
        endDate: testDate(6),
        activityType: ['OW'] as CourseCode[],
      })

      const bookingId7 = await ctx.db.insert('bookings', {
        ownerId: 'dc-ratio',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(6),
        divers: [
          makeDiver('A1', 'AA'), makeDiver('A2', 'AB'), makeDiver('A3', 'AC'),
          makeDiver('A4', 'AD'), makeDiver('A5', 'AE'), makeDiver('A6', 'AF'),
          makeDiver('A7', 'AG'),
        ],
        operatorName: 'Ratio DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: true,
      })

      const bookingId6 = await ctx.db.insert('bookings', {
        ownerId: 'dc-ratio',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(6),
        divers: [
          makeDiver('B1', 'BA'), makeDiver('B2', 'BB'), makeDiver('B3', 'BC'),
          makeDiver('B4', 'BD'), makeDiver('B5', 'BE'), makeDiver('B6', 'BF'),
        ],
        operatorName: 'Ratio DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: true,
      })

      return { bookingId7, bookingId6 }
    })

    const mixedResources: Array<{ resourceType: string; roleType?: BookingRoleType; externalName?: string }> = [
      { resourceType: 'Instructor', externalName: 'External Instructor' },
      { resourceType: 'Instructor', roleType: 'DiveMaster', externalName: 'External DM' },
    ]

    const makeBookingData = (divers: { name: string; abbrev: string }[]) => ({
      activityType: ['OW'] as CourseCode[],
      startDate: testDate(5),
      endDate: testDate(6),
      portalContact: false,
      portalMedical: false,
      portalWaiver: false,
      divers: divers.map((d) => ({
        ...d,
        flag: { code: 'US', label: 'English' },
        startDate: testDate(5),
        endDate: testDate(6),
        activityType: ['OW'] as CourseCode[],
      })),
      resources: mixedResources,
    })

    // 7 divers, capacity 6 → VALIDATION error
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-ratio' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: bookingId7,
          sessions: [],
          bookingData: makeBookingData([
            { name: 'A1', abbrev: 'AA' }, { name: 'A2', abbrev: 'AB' },
            { name: 'A3', abbrev: 'AC' }, { name: 'A4', abbrev: 'AD' },
            { name: 'A5', abbrev: 'AE' }, { name: 'A6', abbrev: 'AF' },
            { name: 'A7', abbrev: 'AG' },
          ]),
        },
      ),
      'VALIDATION',
    )

    // 6 divers, capacity 6 → accepted
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-ratio' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: bookingId6,
        sessions: [],
        bookingData: makeBookingData([
          { name: 'B1', abbrev: 'BA' }, { name: 'B2', abbrev: 'BB' },
          { name: 'B3', abbrev: 'BC' }, { name: 'B4', abbrev: 'BD' },
          { name: 'B5', abbrev: 'BE' }, { name: 'B6', abbrev: 'BF' },
        ]),
      },
    )
  })

  it('18 — contact data round-trip: contactType and contactValue persist on divers (DD-353)', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-contact',
        slug: 'dc-contact',
        email: 'dc@contact.com',
        name: 'dc-contact',
        firstName: 'DC',
        lastName: 'Contact',
        businessName: 'Contact DC',
        isSeeded: false,
        appLanguage: 'en',
      })
      return ctx.db.insert('bookings', {
        ownerId: 'dc-contact',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 43200000,
        paid: false,
        activityType: ['DSD'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'Contact DC',
        portalContact: true,
        portalMedical: true,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-contact' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [],
        bookingData: {
          activityType: ['DSD'] as CourseCode[],
          startDate: testDate(5),
          endDate: testDate(5),
          portalContact: true,
          portalMedical: true,
          portalWaiver: false,
          resources: [{ resourceType: 'Instructor', externalName: 'External Instructor' }],
          divers: [
            {
              name: 'Carlos Diver',
              abbrev: 'C',
              flag: { code: 'MX', label: 'Mexico' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'] as CourseCode[],
              contactType: 'whatsapp' as const,
              contactValue: '+52 555 123 4567',
            },
            {
              name: 'Dani Diver',
              abbrev: 'D',
              flag: { code: 'TH', label: 'Thailand' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'] as CourseCode[],
              contactType: 'line' as const,
              contactValue: 'dani_line_id',
            },
            {
              name: 'Eva Diver',
              abbrev: 'E',
              flag: { code: 'GB', label: 'English' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'] as CourseCode[],
              contactType: 'email' as const,
              contactValue: 'eva@example.com',
            },
          ],
        },
      },
    )

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking!.divers).toHaveLength(3)

      expect(booking!.divers[0].contactType).toBe('whatsapp')
      expect(booking!.divers[0].contactValue).toBe('+52 555 123 4567')

      expect(booking!.divers[1].contactType).toBe('line')
      expect(booking!.divers[1].contactValue).toBe('dani_line_id')

      expect(booking!.divers[2].contactType).toBe('email')
      expect(booking!.divers[2].contactValue).toBe('eva@example.com')
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
        startDate: testDate(5),
        endDate: testDate(5),
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
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
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
        date: testDate(5),
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
        startDate: testDate(5),
        endDate: testDate(5),
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
        date: testDate(5),
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
        startDate: testDate(5),
        endDate: testDate(5),
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
        date: testDate(5),
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


// ─── Overlap Granularity Tests ────────────────────────────────────────────────

// Shared helpers for overlap tests
function makeBoatDcUser(slug: string) {
  return {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: 'DC',
    lastName: 'Test',
    businessName: `${slug} Business`,
    isSeeded: false,
    appLanguage: 'en',
  }
}

async function setupBoatOverlapScenario(
  ctx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  opts: {
    slug: string
    boatType: string
    capacityModel?: 'Exclusive' | 'Pooled'
    totalUnits?: number
  },
) {
  await ctx.db.insert('users', makeBoatDcUser(opts.slug))
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: opts.slug,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(5),
    divers: [],
    operatorName: `${opts.slug} Business`,
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
  })
  const unitId = await ctx.db.insert('inventoryUnits', {
    resourceType: 'Boat',
    resourceId: opts.slug,
    displayName: `${opts.boatType} unit`,
    capacityModel: opts.capacityModel ?? 'Exclusive',
    totalUnits: opts.totalUnits ?? 1,
    ownerId: opts.slug,
    ownerType: 'Boat',
    boatType: opts.boatType,
  })
  return { bookingId, unitId }
}

describe('overlap granularity — isFullDayResource helper', () => {
  it('12 — identifies day_boat and liveaboard as full-day resources', () => {
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'day_boat' })).toBe(true)
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'liveaboard' })).toBe(true)
  })

  it('12 — identifies speedboat, longtail, catamaran, rib as time-window resources', () => {
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'speedboat' })).toBe(false)
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'longtail' })).toBe(false)
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'catamaran' })).toBe(false)
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'rib' })).toBe(false)
  })

  it('12 — non-Boat resources are always time-window', () => {
    expect(isFullDayResource({ resourceType: 'Instructor' })).toBe(false)
    expect(isFullDayResource({ resourceType: 'Equipment' })).toBe(false)
    expect(isFullDayResource({ resourceType: 'Pool' })).toBe(false)
    expect(isFullDayResource({ resourceType: 'Boat' })).toBe(false) // missing boatType = safe default
  })

  it('13 — inventoryUnit boatType field is stored and read correctly', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-dc',
        displayName: 'Day Boat',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'boat-dc',
        ownerType: 'Boat',
        boatType: 'day_boat',
      })
      const unit = await ctx.db.get(unitId)
      expect(unit?.boatType).toBe('day_boat')
      expect(isFullDayResource(unit!)).toBe(true)
    })
  })
})

describe('overlap granularity — full-day conflict (submitToDraft)', () => {
  it('1-overlap — day boat blocks entire date: second booking different window → CONFLICT', async () => {
    const t = makeT()

    const { bookingId: b1, unitId } = await t.run(async (ctx) => {
      return setupBoatOverlapScenario(ctx, { slug: 'dc-dayboat-1', boatType: 'day_boat' })
    })

    // First booking: 08:00-16:00
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-dayboat-1' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '16:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    // Second booking for same day boat, different time window → must CONFLICT
    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-dayboat-1',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-dayboat-1 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-dayboat-1' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: b2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '13:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })

  it('2-overlap — liveaboard blocks entire date: second booking same date → CONFLICT', async () => {
    const t = makeT()

    const { bookingId: b1, unitId } = await t.run(async (ctx) => {
      return setupBoatOverlapScenario(ctx, { slug: 'dc-liveaboard-2', boatType: 'liveaboard' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-liveaboard-2' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '16:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-liveaboard-2',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-liveaboard-2 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-liveaboard-2' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: b2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '09:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })

  it('3-overlap — speedboat allows same-day different window: succeeds', async () => {
    const t = makeT()

    const { bookingId: b1, unitId } = await t.run(async (ctx) => {
      return setupBoatOverlapScenario(ctx, {
        slug: 'dc-speedboat-3',
        boatType: 'speedboat',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
    })

    // First booking: 08:00-12:00
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-speedboat-3' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '12:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    // Second booking same day, different window: should succeed (time-window resource)
    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-speedboat-3',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-speedboat-3 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    // Should NOT throw CONFLICT
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-speedboat-3' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b2,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '13:00',
            endTime: '17:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(2)
    })
  })

  it('4-overlap — longtail allows same-day different window: succeeds', async () => {
    const t = makeT()

    const { bookingId: b1, unitId } = await t.run(async (ctx) => {
      return setupBoatOverlapScenario(ctx, { slug: 'dc-longtail-4', boatType: 'longtail' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-longtail-4' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-longtail-4',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-longtail-4 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-longtail-4' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b2,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '13:00',
            endTime: '16:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(2)
    })
  })

  it('5-overlap — catamaran allows same-day different window: succeeds', async () => {
    const t = makeT()

    const { bookingId: b1, unitId } = await t.run(async (ctx) => {
      return setupBoatOverlapScenario(ctx, { slug: 'dc-catamaran-5', boatType: 'catamaran' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-catamaran-5' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '12:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-catamaran-5',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-catamaran-5 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-catamaran-5' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b2,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '14:00',
            endTime: '18:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(2)
    })
  })

  it('6-overlap — RIB allows same-day different window: succeeds', async () => {
    const t = makeT()

    const { bookingId: b1, unitId } = await t.run(async (ctx) => {
      return setupBoatOverlapScenario(ctx, { slug: 'dc-rib-6', boatType: 'rib' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-rib-6' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '10:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-rib-6',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-rib-6 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-rib-6' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b2,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '11:00',
            endTime: '13:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(2)
    })
  })

  it('7-overlap — speedboat blocks same time window: CONFLICT', async () => {
    const t = makeT()

    const { bookingId: b1, unitId } = await t.run(async (ctx) => {
      return setupBoatOverlapScenario(ctx, { slug: 'dc-speedboat-7', boatType: 'speedboat' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-speedboat-7' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '12:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-speedboat-7',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-speedboat-7 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-speedboat-7' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: b2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '12:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })

  it('8-overlap — instructor allows same-day different window: succeeds', async () => {
    const t = makeT()

    const unitId = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeBoatDcUser('dc-instr-8'))
      return ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instr-8',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instr-8',
        ownerType: 'Instructor',
      })
    })

    const b1 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-instr-8',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-instr-8 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-instr-8' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '12:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-instr-8',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-instr-8 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    // Different window → should succeed
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-instr-8' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b2,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '13:00',
            endTime: '17:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    await t.run(async (ctx) => {
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(2)
    })
  })

  it('9-overlap — instructor blocks overlapping window: CONFLICT', async () => {
    const t = makeT()

    const unitId = await t.run(async (ctx) => {
      await ctx.db.insert('users', makeBoatDcUser('dc-instr-9'))
      return ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instr-9',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instr-9',
        ownerType: 'Instructor',
      })
    })

    const b1 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-instr-9',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-instr-9 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    // Booking 1: 08:00-12:00
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-instr-9' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId: b1,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '08:00',
            endTime: '12:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const b2 = await t.run(async (ctx) => {
      return ctx.db.insert('bookings', {
        ownerId: 'dc-instr-9',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        operatorName: 'dc-instr-9 Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    // Booking 2: 08:00-12:00 (same window) → CONFLICT (snapshot at 08:00 has availableUnits=0)
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-instr-9' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId: b2,
          sessions: [
            {
              inventoryUnitId: unitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '12:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
        },
      ),
      'CONFLICT',
    )
  })
})
