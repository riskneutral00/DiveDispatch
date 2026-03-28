/**
 * cancelBooking — resource stakeholder notifications on inventory release
 *
 * Tests:
 * 1: Cancel booking with 2 confirmed reservations (different owners) sends 2 notifications
 * 2: Notification fields are correct (type, userId, bookingId, message)
 * 3: Cancel booking with no active reservations sends zero notifications
 * 4: Duplicate owners receive one notification each (not deduplicated — one per reservation)
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { testDate } from './helpers/dates'
import {
  seedUser,
  seedBooking,
  seedSession,
  seedReservation,
  seedInventoryUnit,
  seedSnapshot,
  TEST_SLUGS,
  TEST_TOKENS,
} from './fixtures'

describe('cancelBooking notifications', () => {
  // ── 1. Two confirmed reservations, two different owners ─────────────────
  it('1 -- sends a booking_cancelled notification to each resource owner', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      // Operator who owns the booking
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      // Two resource stakeholders
      await seedUser(ctx, { slug: 'instr-a', tokenIdentifier: 'clerk|instr-a', role: 'Instructor' })
      await seedUser(ctx, { slug: 'boat-b', tokenIdentifier: 'clerk|boat-b', role: 'Boat' })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
      })

      // Inventory units owned by different stakeholders
      const unitA = await seedInventoryUnit(ctx, {
        ownerId: 'instr-a',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor A',
      })
      const unitB = await seedInventoryUnit(ctx, {
        ownerId: 'boat-b',
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'Boat B',
      })

      // Snapshots (reserved = 1 so release can restore)
      const snapA = await seedSnapshot(ctx, unitA, { reservedUnits: 1, availableUnits: 0 })
      const snapB = await seedSnapshot(ctx, unitB, { reservedUnits: 1, availableUnits: 0 })

      // Sessions
      const sessionA = await seedSession(ctx, bookingId, unitA)
      const sessionB = await seedSession(ctx, bookingId, unitB)

      // Confirmed reservations
      await seedReservation(ctx, bookingId, unitA, sessionA, { status: 'Confirmed' })
      await seedReservation(ctx, bookingId, unitB, sessionB, { status: 'Confirmed' })

      return { bookingId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(2)

    const recipientIds = notifications.map((n) => n.userId).sort()
    expect(recipientIds).toEqual(['boat-b', 'instr-a'])
  })

  // ── 2. Notification fields are correct ──────────────────────────────────
  it('2 -- notification has correct type, userId, bookingId, and message', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instr-x', tokenIdentifier: 'clerk|instr-x', role: 'Instructor' })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
      })

      const unit = await seedInventoryUnit(ctx, {
        ownerId: 'instr-x',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor X',
      })

      await seedSnapshot(ctx, unit, { reservedUnits: 1, availableUnits: 0 })
      const session = await seedSession(ctx, bookingId, unit)
      await seedReservation(ctx, bookingId, unit, session, { status: 'Confirmed' })

      return { bookingId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(1)
    const n = notifications[0]
    expect(n.type).toBe('booking_cancelled')
    expect(n.userId).toBe('instr-x')
    expect(n.bookingId).toBe(bookingId)
    expect(n.message).toEqual(expect.stringContaining('cancelled'))
  })

  // ── 3. No active reservations = no notifications ────────────────────────
  it('3 -- sends zero notifications when booking has no active reservations', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        status: 'Draft',
      })

      return { bookingId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(0)
  })

  // ── 4. Same owner with multiple reservations gets multiple notifications ─
  it('4 -- same owner with 2 reservations receives 2 notifications', async () => {
    const t = makeT()

    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-slug', tokenIdentifier: 'clerk|dc-slug', role: 'DiveCenter' })
      await seedUser(ctx, { slug: 'instr-a', tokenIdentifier: 'clerk|instr-a', role: 'Instructor' })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-slug',
        status: 'Upcoming',
        bookingFormComplete: true,
        customerFormComplete: true,
      })

      // Same owner, two units
      const unitA = await seedInventoryUnit(ctx, {
        ownerId: 'instr-a',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor A - Unit 1',
      })
      const unitB = await seedInventoryUnit(ctx, {
        ownerId: 'instr-a',
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'Instructor A - Unit 2',
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
      .withIdentity({ tokenIdentifier: 'clerk|dc-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const notifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('type'), 'booking_cancelled'))
        .collect(),
    )

    expect(notifications).toHaveLength(2)
    expect(notifications.every((n) => n.userId === 'instr-a')).toBe(true)
  })
})
