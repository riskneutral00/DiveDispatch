import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { testDate } from './helpers/dates'
import { makeT } from './helpers/convex-helpers'
import {
  seedUser,
  seedBooking,
  seedSession,
  seedReservation,
  seedInventoryUnit,
  seedSnapshot,
} from './fixtures'

describe('discardDraft notifications (DD-340)', () => {
  it('1 -- sends booking_cancelled notification to each resource owner on discard', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-owner', tokenIdentifier: 'clerk|dc-owner', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instr-1', tokenIdentifier: 'clerk|instr-1', role: 'Instructor' })
      await seedUser(ctx, { slug: 'boat-2', tokenIdentifier: 'clerk|boat-2', role: 'Boat' })

      const bookingId = await seedBooking(ctx, { ownerId: 'dc-owner', status: 'Draft' })

      const unitA = await seedInventoryUnit(ctx, {
        ownerId: 'instr-1',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor One',
      })
      const unitB = await seedInventoryUnit(ctx, {
        ownerId: 'boat-2',
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'Boat Two',
      })

      await seedSnapshot(ctx, unitA, { reservedUnits: 1, availableUnits: 0 })
      await seedSnapshot(ctx, unitB, { reservedUnits: 1, availableUnits: 0 })

      const sessionA = await seedSession(ctx, bookingId, unitA)
      const sessionB = await seedSession(ctx, bookingId, unitB)

      await seedReservation(ctx, bookingId, unitA, sessionA, { status: 'Confirmed' })
      await seedReservation(ctx, bookingId, unitB, sessionB, { status: 'Confirmed' })

      return { bookingId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-owner' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(2)
    const recipientIds = notifications.map((n) => n.userId).sort()
    expect(recipientIds).toEqual(['boat-2', 'instr-1'])
  })

  it('2 -- discardDraft with no active reservations sends zero notifications', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-empty', tokenIdentifier: 'clerk|dc-empty', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-empty', status: 'Draft' })
      return { bookingId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-empty' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(0)
  })
})

describe('submitToDraft edit-resubmit notifications (DD-340)', () => {
  it('3 -- edit-mode resubmit notifies resource owner whose old reservation was vacated', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-edit', tokenIdentifier: 'clerk|dc-edit', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instr-old', tokenIdentifier: 'clerk|instr-old', role: 'Instructor' })

      const bookingId = await seedBooking(ctx, { ownerId: 'dc-edit', status: 'Draft', bookingFormComplete: false, divers: [] })

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: 'instr-old',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Old Instructor Unit',
      })

      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        reservedUnits: 1,
        availableUnits: 0,
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
      })

      await seedReservation(ctx, bookingId, unitId, sessionId, {
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })

      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-edit' }).mutation(
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

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe('instr-old')
    expect(notifications[0].bookingId).toBe(bookingId)
  })

  it('4 -- edit-mode resubmit with new resource notifies old owner only, not new owner', async () => {
    const t = makeT()

    const { bookingId, unitBId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-swap', tokenIdentifier: 'clerk|dc-swap', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instr-old', tokenIdentifier: 'clerk|instr-old', role: 'Instructor' })
      await seedUser(ctx, { slug: 'instr-new', tokenIdentifier: 'clerk|instr-new', role: 'Instructor' })

      const bookingId = await seedBooking(ctx, { ownerId: 'dc-swap', status: 'Draft', bookingFormComplete: false, divers: [] })

      const unitAId = await seedInventoryUnit(ctx, {
        ownerId: 'instr-old',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Old Instructor Unit',
      })

      const unitBId = await seedInventoryUnit(ctx, {
        ownerId: 'instr-new',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'New Instructor Unit',
      })

      await seedSnapshot(ctx, unitAId, {
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        reservedUnits: 1,
        availableUnits: 0,
      })

      await seedSnapshot(ctx, unitBId, {
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        reservedUnits: 0,
        availableUnits: 1,
      })

      const sessionAId = await seedSession(ctx, bookingId, unitAId, {
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
      })

      await seedReservation(ctx, bookingId, unitAId, sessionAId, {
        status: 'Confirmed',
        confirmedAt: Date.now(),
      })

      return { bookingId, unitBId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-swap' }).mutation(
      api.bookings.create.submitToDraft,
      {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitBId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
      },
    )

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe('instr-old')
    expect(notifications[0].bookingId).toBe(bookingId)
  })
})
