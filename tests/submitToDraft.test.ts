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
import {
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedSnapshot,
  seedSession,
  seedReservation,
  seedBlockedDates,
  seedStakeholderPreferences,
} from './fixtures'

describe('submitToDraft', () => {
  it('1 — single booking: creates reservation + snapshot (Exclusive)', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      await seedUser(ctx, { tokenIdentifier: 'clerk|instructor-1', slug: 'instructor-1', role: 'Instructor' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedSnapshot(ctx, unitId, {
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-1',
        ownerType: 'Boat',
        displayName: 'Boat unit',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      await seedSnapshot(ctx, unitId, {
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-1',
        ownerType: 'Boat',
        displayName: 'Boat unit',
        capacityModel: 'Pooled',
        totalUnits: 5,
      })
      await seedSnapshot(ctx, unitId, {
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const exclusiveId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const pooledId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-1',
        ownerType: 'Boat',
        displayName: 'Boat unit',
        capacityModel: 'Pooled',
        totalUnits: 20,
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
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      return { bookingId, unitId }
    })

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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      await seedBlockedDates(ctx, {
        stakeholderId: 'dc-test',
        roleType: 'DiveCenter',
        dates: [testDate(5)],
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      await seedUser(ctx, { tokenIdentifier: 'clerk|instructor-1', slug: 'instructor-1', role: 'Instructor' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
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
      const snap = await ctx.db.query('availabilitySnapshots').collect()
      expect(snap[0].availableUnits).toBe(0)
    })

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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-auto',
        ownerType: 'Instructor',
        displayName: 'Auto instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedStakeholderPreferences(ctx, 'instructor-auto', {
        stakeholderType: 'Instructor',
        acceptanceMode: 'Auto',
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        customerFormComplete: true,
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-autoadvance',
        ownerType: 'Instructor',
        displayName: 'Auto-advance instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedStakeholderPreferences(ctx, 'instructor-autoadvance', {
        stakeholderType: 'Instructor',
        acceptanceMode: 'Auto',
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
      })
      const goodUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-good',
        ownerType: 'Boat',
        displayName: 'Good boat',
        capacityModel: 'Pooled',
        totalUnits: 10,
      })
      const busyUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-busy',
        ownerType: 'Instructor',
        displayName: 'Busy instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedSnapshot(ctx, busyUnitId, {
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        customerFormComplete: true,
        divers: [],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const boatUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-1',
        ownerType: 'Boat',
        displayName: 'Speedboat',
        capacityModel: 'Pooled',
        totalUnits: 20,
      })
      const instructorUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor slot',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
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

  it('14 — all-external: zero reservations, zero snapshots, bookingFormComplete = true', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      await seedUser(ctx, { tokenIdentifier: 'clerk|instructor-mix', slug: 'instructor-mix', role: 'Instructor' })
      const instructorUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-mix',
        ownerType: 'Instructor',
        displayName: 'Internal instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
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
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(1)
      expect(reservations[0].inventoryUnitId).toBe(instructorUnitId)

      const snapshots = await ctx.db.query('availabilitySnapshots').collect()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].inventoryUnitId).toBe(instructorUnitId)
      expect(snapshots[0].reservedUnits).toBe(1)

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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-test', slug: 'dc-test' })
      const instructorUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-advance',
        ownerType: 'Instructor',
        displayName: 'Auto-advance instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      await seedStakeholderPreferences(ctx, 'instructor-advance', {
        stakeholderType: 'Instructor',
        acceptanceMode: 'Auto',
      })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        bookingFormComplete: false,
        customerFormComplete: true,
        divers: [],
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
      const reservations = await ctx.db.query('reservations').collect()
      expect(reservations).toHaveLength(1)
      expect(reservations[0].status).toBe('Confirmed')

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')
      expect(booking?.bookingFormComplete).toBe(true)
    })
  })

  it('17 — ratio validation: mixed instructor + DiveMaster resources enforce correct capacity', async () => {
    const t = makeT()

    const { bookingId7, bookingId6 } = await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-ratio', slug: 'dc-ratio' })

      const makeDiver = (name: string, abbrev: string) => ({
        name,
        abbrev,
        flag: { code: 'US', label: 'English' },
        startDate: testDate(5),
        endDate: testDate(6),
        activityType: ['OW'] as CourseCode[],
      })

      const bookingId7 = await seedBooking(ctx, {
        ownerId: 'dc-ratio',
        operatorName: 'Ratio DC',
        status: 'Draft',
        bookingFormComplete: false,
        customerFormComplete: true,
        startDate: testDate(5),
        endDate: testDate(6),
        divers: [
          makeDiver('A1', 'AA'), makeDiver('A2', 'AB'), makeDiver('A3', 'AC'),
          makeDiver('A4', 'AD'), makeDiver('A5', 'AE'), makeDiver('A6', 'AF'),
          makeDiver('A7', 'AG'),
        ],
      })

      const bookingId6 = await seedBooking(ctx, {
        ownerId: 'dc-ratio',
        operatorName: 'Ratio DC',
        status: 'Draft',
        bookingFormComplete: false,
        customerFormComplete: true,
        startDate: testDate(5),
        endDate: testDate(6),
        divers: [
          makeDiver('B1', 'BA'), makeDiver('B2', 'BB'), makeDiver('B3', 'BC'),
          makeDiver('B4', 'BD'), makeDiver('B5', 'BE'), makeDiver('B6', 'BF'),
        ],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-contact', slug: 'dc-contact' })
      return seedBooking(ctx, {
        ownerId: 'dc-contact',
        operatorName: 'Contact DC',
        status: 'Draft',
        bookingFormComplete: false,
        activityType: ['DSD'],
        startDate: testDate(5),
        endDate: testDate(5),
        portalContact: true,
        portalMedical: true,
        divers: [],
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

describe('releaseBookingReservations', () => {
  it('vacates active reservations and restores snapshot counts', async () => {
    const t = makeT()

    const { bookingId, resId, snapshotId } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const snapshotId = await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
      })
      const resId = await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'PendingAcceptance',
        unitsRequested: 1,
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
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        customerFormComplete: true,
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Confirmed',
        unitsRequested: 1,
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
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Confirmed',
        unitsRequested: 1,
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
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        customerFormComplete: true,
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

  it('stays Draft when medical hard block is active', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-test',
        status: 'Draft',
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
        medicalHardBlock: true,
        customerFormComplete: true,
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Confirmed',
        unitsRequested: 1,
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
    expect(isFullDayResource({ resourceType: 'Boat' })).toBe(false)
  })

  it('13 — inventoryUnit boatType field is stored and read correctly', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'boat-dc',
        ownerType: 'Boat',
        displayName: 'Day Boat',
        capacityModel: 'Exclusive',
        totalUnits: 1,
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-dayboat-1', slug: 'dc-dayboat-1' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-dayboat-1',
        operatorName: 'dc-dayboat-1 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'dc-dayboat-1',
        ownerType: 'Boat',
        displayName: 'day_boat unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        boatType: 'day_boat',
      })
      return { bookingId, unitId }
    })

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

    const b2 = await t.run(async (ctx) => {
      return seedBooking(ctx, {
        ownerId: 'dc-dayboat-1',
        operatorName: 'dc-dayboat-1 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-liveaboard-2', slug: 'dc-liveaboard-2' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-liveaboard-2',
        operatorName: 'dc-liveaboard-2 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'dc-liveaboard-2',
        ownerType: 'Boat',
        displayName: 'liveaboard unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        boatType: 'liveaboard',
      })
      return { bookingId, unitId }
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
      return seedBooking(ctx, {
        ownerId: 'dc-liveaboard-2',
        operatorName: 'dc-liveaboard-2 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-speedboat-3', slug: 'dc-speedboat-3' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-speedboat-3',
        operatorName: 'dc-speedboat-3 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'dc-speedboat-3',
        ownerType: 'Boat',
        displayName: 'speedboat unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        boatType: 'speedboat',
      })
      return { bookingId, unitId }
    })

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

    const b2 = await t.run(async (ctx) => {
      return seedBooking(ctx, {
        ownerId: 'dc-speedboat-3',
        operatorName: 'dc-speedboat-3 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
    })

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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-longtail-4', slug: 'dc-longtail-4' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-longtail-4',
        operatorName: 'dc-longtail-4 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'dc-longtail-4',
        ownerType: 'Boat',
        displayName: 'longtail unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        boatType: 'longtail',
      })
      return { bookingId, unitId }
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
      return seedBooking(ctx, {
        ownerId: 'dc-longtail-4',
        operatorName: 'dc-longtail-4 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-catamaran-5', slug: 'dc-catamaran-5' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-catamaran-5',
        operatorName: 'dc-catamaran-5 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'dc-catamaran-5',
        ownerType: 'Boat',
        displayName: 'catamaran unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        boatType: 'catamaran',
      })
      return { bookingId, unitId }
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
      return seedBooking(ctx, {
        ownerId: 'dc-catamaran-5',
        operatorName: 'dc-catamaran-5 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-rib-6', slug: 'dc-rib-6' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-rib-6',
        operatorName: 'dc-rib-6 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'dc-rib-6',
        ownerType: 'Boat',
        displayName: 'rib unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        boatType: 'rib',
      })
      return { bookingId, unitId }
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
      return seedBooking(ctx, {
        ownerId: 'dc-rib-6',
        operatorName: 'dc-rib-6 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
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
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-speedboat-7', slug: 'dc-speedboat-7' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-speedboat-7',
        operatorName: 'dc-speedboat-7 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        ownerId: 'dc-speedboat-7',
        ownerType: 'Boat',
        displayName: 'speedboat unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        boatType: 'speedboat',
      })
      return { bookingId, unitId }
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
      return seedBooking(ctx, {
        ownerId: 'dc-speedboat-7',
        operatorName: 'dc-speedboat-7 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
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

    const { unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-instr-8', slug: 'dc-instr-8' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instr-8',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      return { unitId }
    })

    const b1 = await t.run(async (ctx) => {
      return seedBooking(ctx, {
        ownerId: 'dc-instr-8',
        operatorName: 'dc-instr-8 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
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
      return seedBooking(ctx, {
        ownerId: 'dc-instr-8',
        operatorName: 'dc-instr-8 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
    })

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

    const { unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-instr-9', slug: 'dc-instr-9' })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instr-9',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      return { unitId }
    })

    const b1 = await t.run(async (ctx) => {
      return seedBooking(ctx, {
        ownerId: 'dc-instr-9',
        operatorName: 'dc-instr-9 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
    })

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
      return seedBooking(ctx, {
        ownerId: 'dc-instr-9',
        operatorName: 'dc-instr-9 Business',
        status: 'Draft',
        bookingFormComplete: false,
        startDate: testDate(5),
        endDate: testDate(5),
        divers: [],
      })
    })

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
