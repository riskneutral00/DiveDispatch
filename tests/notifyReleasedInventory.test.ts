/**
 * notifyReleasedInventory — unit tests for the extracted notification helper.
 *
 * Tests:
 * 1: Deduplicates by inventoryUnitId — same unit across multiple reservations sends one notification
 * 2: Empty vacated list produces zero notifications
 * 3: Multiple unique units each produce one notification with correct fields
 * 4: releaseBookingReservations returns the vacated reservation list (not void)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { notifyReleasedInventory } from '../convex/notifications'
import { releaseBookingReservations } from '../convex/bookings/inventoryRelease'
import type { Doc } from '../convex/_generated/dataModel'
import { VACATED_REASON } from '../convex/shared/statuses'
import {
  seedUser,
  seedBooking,
  seedSession,
  seedReservation,
  seedInventoryUnit,
  seedSnapshot,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

describe('notifyReleasedInventory', () => {
  it('deduplicates by inventoryUnitId — same unit with 2 reservations sends 1 notification', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-a', tokenIdentifier: 'clerk|owner-a', role: 'Instructor' })

      const unit = await seedInventoryUnit(ctx, {
        ownerId: 'owner-a',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor Alpha',
      })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionA = await seedSession(ctx, bookingId, unit)
      const sessionB = await seedSession(ctx, bookingId, unit, { date: '2026-04-02', startTime: '10:00', endTime: '12:00' })
      await seedSnapshot(ctx, unit, { reservedUnits: 1, availableUnits: 0 })
      await seedSnapshot(ctx, unit, { reservedUnits: 1, availableUnits: 0, date: '2026-04-02', windowStart: '10:00' })

      const resA = await seedReservation(ctx, bookingId, unit, sessionA, { status: 'Confirmed' })
      const resB = await seedReservation(ctx, bookingId, unit, sessionB, { status: 'Confirmed' })

      // Build a fake vacated list with same inventoryUnitId appearing twice
      const docA = await ctx.db.get(resA) as Doc<'reservations'>
      const docB = await ctx.db.get(resB) as Doc<'reservations'>

      await notifyReleasedInventory(ctx, bookingId, [docA, docB])

      const notifications = await ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect()

      // Deduplicated: 1 unique unit → 1 notification
      expect(notifications).toHaveLength(1)
      expect(notifications[0].userId).toBe('owner-a')
      expect(notifications[0].message).toContain('Instructor Alpha')
    })
  })

  it('empty vacated list produces zero notifications', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Draft' })

      await notifyReleasedInventory(ctx, bookingId, [])

      const notifications = await ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect()

      expect(notifications).toHaveLength(0)
    })
  })

  it('multiple unique units each produce one notification with correct fields', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'instr-x', tokenIdentifier: 'clerk|instr-x', role: 'Instructor' })
      await seedUser(ctx, { slug: 'boat-y', tokenIdentifier: 'clerk|boat-y', role: 'Boat' })

      const unitA = await seedInventoryUnit(ctx, {
        ownerId: 'instr-x',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor X',
      })
      const unitB = await seedInventoryUnit(ctx, {
        ownerId: 'boat-y',
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'Boat Y',
      })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const sessionA = await seedSession(ctx, bookingId, unitA)
      const sessionB = await seedSession(ctx, bookingId, unitB)
      await seedSnapshot(ctx, unitA, { reservedUnits: 1, availableUnits: 0 })
      await seedSnapshot(ctx, unitB, { reservedUnits: 1, availableUnits: 0 })

      const resA = await seedReservation(ctx, bookingId, unitA, sessionA, { status: 'Confirmed' })
      const resB = await seedReservation(ctx, bookingId, unitB, sessionB, { status: 'Confirmed' })

      const docA = await ctx.db.get(resA) as Doc<'reservations'>
      const docB = await ctx.db.get(resB) as Doc<'reservations'>

      await notifyReleasedInventory(ctx, bookingId, [docA, docB])

      const notifications = await ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect()

      expect(notifications).toHaveLength(2)
      const recipients = notifications.map((n) => n.userId).sort()
      expect(recipients).toEqual(['boat-y', 'instr-x'])

      const instrNotif = notifications.find((n) => n.userId === 'instr-x')!
      expect(instrNotif.bookingId).toBe(bookingId)
      expect(instrNotif.message).toContain('Instructor X')

      const boatNotif = notifications.find((n) => n.userId === 'boat-y')!
      expect(boatNotif.bookingId).toBe(bookingId)
      expect(boatNotif.message).toContain('Boat Y')
    })
  })
})

describe('releaseBookingReservations return value', () => {
  it('returns the vacated reservation list instead of void', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 3, displayName: 'Boat A' })
      await seedSnapshot(ctx, unit, { totalUnits: 3, availableUnits: 1, reservedUnits: 2 })

      const bookingId = await seedBooking(ctx, { status: 'Upcoming' })
      const session = await seedSession(ctx, bookingId, unit)
      await seedReservation(ctx, bookingId, unit, session, { status: 'Confirmed' })

      const vacated = await releaseBookingReservations(ctx, bookingId, VACATED_REASON.BookingCancelled)

      expect(vacated).toHaveLength(1)
      expect(vacated[0].inventoryUnitId).toBe(unit)
      expect(vacated[0].bookingId).toBe(bookingId)
    })
  })

  it('returns empty array when no active reservations exist', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const bookingId = await seedBooking(ctx, { status: 'Draft' })

      const vacated = await releaseBookingReservations(ctx, bookingId, VACATED_REASON.HoldExpired)

      expect(vacated).toHaveLength(0)
    })
  })
})
