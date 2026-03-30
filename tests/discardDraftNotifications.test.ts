/**
 * DD-340: discardDraft and edit-resubmit must notify stakeholders whose inventory
 * was released — both were silently discarding the vacated list.
 *
 * Tests:
 * 1: discardDraft sends a booking_cancelled notification to each released resource owner
 * 2: discardDraft with no active reservations sends zero notifications
 * 3: Edit-mode resubmit (submitToDraft over existing reservations) sends notifications for vacated resources
 * 4: Edit-mode resubmit with new resources sends notifications only for old (released) resources
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
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
  // ── 1. discardDraft sends notification to each released resource owner ─────
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

  // ── 2. discardDraft with no reservations sends zero notifications ──────────
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
  // ── 3. Edit-resubmit sends notifications for vacated (old) resources ───────
  it('3 -- edit-mode resubmit notifies resource owner whose old reservation was vacated', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-edit',
        slug: 'dc-edit',
        email: 'dc-edit@test.com',
        name: 'dc-edit',
        firstName: 'DC',
        lastName: 'Edit',
        businessName: 'Edit DC',
        isSeeded: false,
        appLanguage: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|instr-old',
        slug: 'instr-old',
        email: 'instr-old@test.com',
        name: 'Old Instructor',
        firstName: 'Old',
        lastName: 'Instructor',
        businessName: 'Old Instructor Biz',
        isSeeded: false,
        appLanguage: 'en',
      })

      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-edit',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Edit DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instr-old',
        displayName: 'Old Instructor Unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instr-old',
        ownerType: 'Instructor',
      })

      // Snapshot: 1 reserved, 0 available (already held)
      await ctx.db.insert('availabilitySnapshots', {
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

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now(),
        expiresAt: Date.now() + HOLD_TTL,
      })

      return { bookingId, unitId }
    })

    // Edit-resubmit: same unit, same session (replaces old reservations)
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

    // The old confirmed reservation for 'instr-old' was vacated — they must be notified
    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe('instr-old')
    expect(notifications[0].bookingId).toBe(bookingId)
  })

  // ── 4. Edit-resubmit with SWAPPED resources notifies only old owner ─────────
  it('4 -- edit-mode resubmit with new resource notifies old owner only, not new owner', async () => {
    const t = makeT()

    const { bookingId, unitBId } = await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|dc-swap',
        slug: 'dc-swap',
        email: 'dc-swap@test.com',
        name: 'dc-swap',
        firstName: 'DC',
        lastName: 'Swap',
        businessName: 'Swap DC',
        isSeeded: false,
        appLanguage: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|instr-old',
        slug: 'instr-old',
        email: 'instr-old@test.com',
        name: 'Old Instructor',
        firstName: 'Old',
        lastName: 'Instructor',
        businessName: 'Old Instructor Biz',
        isSeeded: false,
        appLanguage: 'en',
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|instr-new',
        slug: 'instr-new',
        email: 'instr-new@test.com',
        name: 'New Instructor',
        firstName: 'New',
        lastName: 'Instructor',
        businessName: 'New Instructor Biz',
        isSeeded: false,
        appLanguage: 'en',
      })

      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-swap',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Swap DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })

      // Unit A: old instructor (has existing confirmed reservation)
      const unitAId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instr-old',
        displayName: 'Old Instructor Unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instr-old',
        ownerType: 'Instructor',
      })

      // Unit B: new instructor (available, not yet held)
      const unitBId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instr-new',
        displayName: 'New Instructor Unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instr-new',
        ownerType: 'Instructor',
      })

      // Snapshot for unit A: 1 reserved, 0 available (already held)
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitAId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Snapshot for unit B: 0 reserved, 1 available (free to hold)
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitBId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })

      const sessionAId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitAId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitAId,
        bookingSessionId: sessionAId,
        unitsRequested: 1,
        status: 'Confirmed',
        confirmedAt: Date.now(),
        expiresAt: Date.now() + HOLD_TTL,
      })

      return { bookingId, unitBId }
    })

    // Edit-resubmit: replace unit A with unit B
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

    // Only the old resource owner (instr-old) should be notified — not the new one (instr-new)
    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe('instr-old')
    expect(notifications[0].bookingId).toBe(bookingId)
  })
})
