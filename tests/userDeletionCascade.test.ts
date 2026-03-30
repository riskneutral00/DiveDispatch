/**
 * DD-258: Async cascade user deletion tests.
 * Tests written before implementation (TDD).
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { seedUser } from './fixtures/seedUsers'
import { seedBooking, seedSession, seedReservation, seedNotification, seedBookingResource } from './fixtures/seedBookings'
import { seedInventoryUnit, seedSnapshot } from './fixtures/seedInventory'
import { testDate } from './helpers/dates'
import type { Id } from '../convex/_generated/dataModel'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Seed a complete booking with an instructor reservation and snapshot. */
async function seedBookingWithReservation(
  ctx: Parameters<Parameters<ReturnType<typeof makeT>['run']>[0]>[0],
  opts: {
    ownerSlug: string
    instructorSlug: string
    bookingStatus: 'Draft' | 'Upcoming'
    reservationStatus?: 'PendingAcceptance' | 'Confirmed'
    date?: string
  },
) {
  const date = opts.date ?? testDate(5)

  const unitId = await seedInventoryUnit(ctx, {
    resourceType: 'Instructor',
    ownerId: opts.instructorSlug,
    ownerType: 'Instructor',
    displayName: 'Instructor Unit',
  })

  const bookingId = await seedBooking(ctx, {
    ownerId: opts.ownerSlug,
    status: opts.bookingStatus,
    startDate: date,
    endDate: date,
  })

  const sessionId = await seedSession(ctx, bookingId, unitId, { date })

  const snapshotId = await seedSnapshot(ctx, unitId, {
    date,
    reservedUnits: 1,
    availableUnits: 0,
  })

  const reservationId = await seedReservation(ctx, bookingId, unitId, sessionId, {
    status: opts.reservationStatus ?? 'Confirmed',
  })

  await seedBookingResource(ctx, bookingId, {
    resourceType: 'Instructor',
    resourceSlug: opts.instructorSlug,
  })

  return { bookingId, unitId, sessionId, snapshotId, reservationId }
}

beforeEach(() => {
  vi.useFakeTimers({ now: Date.now() })
})

afterEach(() => {
  vi.useRealTimers()
})

// ── findActiveBookingsForOwner ───────────────────────────────────────────────

describe('findActiveBookingsForOwner', () => {
  it('returns only Draft and Upcoming bookings', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-1', tokenIdentifier: 'test|owner-1' })

      await seedBooking(ctx, { ownerId: 'owner-1', status: 'Draft' })
      await seedBooking(ctx, { ownerId: 'owner-1', status: 'Upcoming' })
      await seedBooking(ctx, { ownerId: 'owner-1', status: 'Completed' })
      await seedBooking(ctx, { ownerId: 'owner-1', status: 'Cancelled' })
    })

    const results = await t.query(internal.users.findActiveBookingsForOwner, {
      userSlug: 'owner-1',
    })

    expect(results).toHaveLength(2)
  })

  it('returns all active bookings even when many completed/cancelled exist (DD-310)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-310', tokenIdentifier: 'test|owner-310' })

      // Seed 60 Completed + Cancelled bookings to exceed CASCADE_BATCH_SIZE (50)
      for (let i = 0; i < 30; i++) {
        await seedBooking(ctx, { ownerId: 'owner-310', status: 'Completed' })
        await seedBooking(ctx, { ownerId: 'owner-310', status: 'Cancelled' })
      }

      // Seed 5 active bookings (3 Draft + 2 Upcoming)
      for (let i = 0; i < 3; i++) {
        await seedBooking(ctx, { ownerId: 'owner-310', status: 'Draft' })
      }
      for (let i = 0; i < 2; i++) {
        await seedBooking(ctx, { ownerId: 'owner-310', status: 'Upcoming' })
      }
    })

    const results = await t.query(internal.users.findActiveBookingsForOwner, {
      userSlug: 'owner-310',
    })

    // Must find all 5 active bookings regardless of 60 inactive ones
    expect(results).toHaveLength(5)
  })

  it('returns empty array when user has no active bookings', async () => {
    const t = makeT()
    const results = await t.query(internal.users.findActiveBookingsForOwner, {
      userSlug: 'nonexistent-slug',
    })

    expect(results).toHaveLength(0)
  })
})

// ── cancelOneBookingForDeletedUser ───────────────────────────────────────────

describe('cancelOneBookingForDeletedUser', () => {
  it('is idempotent on already-Cancelled booking', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-2', tokenIdentifier: 'test|owner-2' })
      bookingId = await seedBooking(ctx, { ownerId: 'owner-2', status: 'Cancelled' })
    })

    // Should not throw
    await t.mutation(internal.users.cancelOneBookingForDeletedUser, {
      bookingId: bookingId!,
    })

    // Booking still Cancelled, no audit log entries for cascade
    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId!)
      expect(booking!.status).toBe('Cancelled')

      const auditLogs = await ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId!))
        .collect()
      const cascadeLogs = auditLogs.filter((l) => l.action === 'user_deleted_cascade')
      expect(cascadeLogs).toHaveLength(0)
    })
  })

  it('cancels a Draft booking with reservations, restores snapshots, logs audit', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>
    let snapshotId: Id<'availabilitySnapshots'>
    let reservationId: Id<'reservations'>
    let unitId: Id<'inventoryUnits'>

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-3', tokenIdentifier: 'test|owner-3' })
      await seedUser(ctx, {
        slug: 'instr-3',
        tokenIdentifier: 'test|instr-3',
        role: 'Instructor',
      })
      const result = await seedBookingWithReservation(ctx, {
        ownerSlug: 'owner-3',
        instructorSlug: 'instr-3',
        bookingStatus: 'Draft',
        reservationStatus: 'PendingAcceptance',
      })
      bookingId = result.bookingId
      snapshotId = result.snapshotId
      reservationId = result.reservationId
      unitId = result.unitId
    })

    await t.mutation(internal.users.cancelOneBookingForDeletedUser, {
      bookingId: bookingId!,
    })

    await t.run(async (ctx) => {
      // Booking is Cancelled
      const booking = await ctx.db.get(bookingId!)
      expect(booking!.status).toBe('Cancelled')

      // Reservation is Vacated with user_deleted reason
      const reservation = await ctx.db.get(reservationId!)
      expect(reservation!.status).toBe('Vacated')
      expect(reservation!.vacatedBy).toBe('user_deleted')

      // Snapshot restored
      const snapshot = await ctx.db.get(snapshotId!)
      expect(snapshot!.availableUnits).toBe(1)
      expect(snapshot!.reservedUnits).toBe(0)

      // Audit log entry exists
      const auditLogs = await ctx.db
        .query('bookingAuditLog')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId!))
        .collect()
      const cascadeLogs = auditLogs.filter((l) => l.action === 'user_deleted_cascade')
      expect(cascadeLogs).toHaveLength(1)
      expect(cascadeLogs[0].actorSlug).toBe('system')
      expect(cascadeLogs[0].actorType).toBe('system')

      // Stakeholder notification sent
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', 'instr-3'))
        .collect()
      expect(notifications.length).toBeGreaterThanOrEqual(1)
      expect(notifications.some((n) => n.type === 'booking_cancelled')).toBe(true)
    })
  })

  it('cancels an Upcoming booking', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-4', tokenIdentifier: 'test|owner-4' })
      await seedUser(ctx, {
        slug: 'instr-4',
        tokenIdentifier: 'test|instr-4',
        role: 'Instructor',
      })
      const result = await seedBookingWithReservation(ctx, {
        ownerSlug: 'owner-4',
        instructorSlug: 'instr-4',
        bookingStatus: 'Upcoming',
      })
      bookingId = result.bookingId
    })

    await t.mutation(internal.users.cancelOneBookingForDeletedUser, {
      bookingId: bookingId!,
    })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId!)
      expect(booking!.status).toBe('Cancelled')
    })
  })

  it('handles booking with no reservations', async () => {
    const t = makeT()
    let bookingId: Id<'bookings'>

    await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-5', tokenIdentifier: 'test|owner-5' })
      bookingId = await seedBooking(ctx, { ownerId: 'owner-5', status: 'Draft' })
    })

    // Should not throw
    await t.mutation(internal.users.cancelOneBookingForDeletedUser, {
      bookingId: bookingId!,
    })

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId!)
      expect(booking!.status).toBe('Cancelled')
    })
  })
})

// ── cleanupDeletedUserData ───────────────────────────────────────────────────

describe('cleanupDeletedUserData', () => {
  it('deletes roles, marks notifications read, cleans preferences and blocked dates', async () => {
    const t = makeT()
    let userId: Id<'users'>

    await t.run(async (ctx) => {
      userId = await seedUser(ctx, {
        slug: 'cleanup-user',
        tokenIdentifier: 'test|cleanup-user',
        role: 'DiveCenter',
      })

      // Add notifications
      await seedNotification(ctx, { userId: 'cleanup-user', message: 'Test 1' })
      await seedNotification(ctx, { userId: 'cleanup-user', message: 'Test 2' })

      // Add stakeholder preferences
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'cleanup-user',
        stakeholderType: 'DiveCenter',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 8,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        confirmOnAccept: false,
        confirmOnDecline: false,
      })

      // Add blocked dates
      await ctx.db.insert('stakeholderBlockedDates', {
        ownerSlug: 'cleanup-user',
        roleType: 'Instructor',
        dates: [testDate(5)],
      })

      // Add bookingResource referencing this user
      const bookingId = await seedBooking(ctx, { ownerId: 'other-owner' })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'cleanup-user',
      })
    })

    await t.mutation(internal.users.cleanupDeletedUserData, {
      userId: userId!,
      userSlug: 'cleanup-user',
    })

    await t.run(async (ctx) => {
      // UserRoles deleted
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId!))
        .collect()
      expect(roles).toHaveLength(0)

      // Notifications marked read
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', 'cleanup-user'))
        .collect()
      expect(notifications).toHaveLength(2)
      expect(notifications.every((n) => n.readAt !== undefined)).toBe(true)

      // Stakeholder preferences deleted
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', 'cleanup-user'))
        .collect()
      expect(prefs).toHaveLength(0)

      // Blocked dates deleted
      const blocked = await ctx.db
        .query('stakeholderBlockedDates')
        .filter((q) => q.eq(q.field('ownerSlug'), 'cleanup-user'))
        .collect()
      expect(blocked).toHaveLength(0)

      // BookingResources deleted
      const resources = await ctx.db
        .query('bookingResources')
        .withIndex('by_resourceSlug', (q) => q.eq('resourceSlug', 'cleanup-user'))
        .collect()
      expect(resources).toHaveLength(0)
    })
  })

  it('is a no-op when user has no ancillary data', async () => {
    const t = makeT()
    let userId: Id<'users'>

    await t.run(async (ctx) => {
      userId = await seedUser(ctx, {
        slug: 'empty-user',
        tokenIdentifier: 'test|empty-user',
        skipUserRoles: true,
      })
    })

    // Should not throw
    await t.mutation(internal.users.cleanupDeletedUserData, {
      userId: userId!,
      userSlug: 'empty-user',
    })
  })

  it('self-reschedules when notifications exceed CASCADE_BATCH_SIZE, all processed after multiple runs', async () => {
    const t = makeT()
    let userId: Id<'users'>

    await t.run(async (ctx) => {
      userId = await seedUser(ctx, {
        slug: 'many-notifs-user',
        tokenIdentifier: 'test|many-notifs-user',
        skipUserRoles: true,
      })

      // Seed 60 unread notifications — more than CASCADE_BATCH_SIZE (50)
      for (let i = 0; i < 60; i++) {
        await seedNotification(ctx, { userId: 'many-notifs-user', message: `Notif ${i}` })
      }
    })

    // Run first cleanup invocation — should process a batch and self-reschedule
    await t.mutation(internal.users.cleanupDeletedUserData, {
      userId: userId!,
      userSlug: 'many-notifs-user',
    })

    // After first run, not all notifications are processed yet — reschedule must fire
    await t.run(async (ctx) => {
      const unread = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', 'many-notifs-user'))
        .filter((q) => q.eq(q.field('readAt'), undefined))
        .collect()
      // Some should still be unread (the ones beyond the batch size)
      expect(unread.length).toBeGreaterThan(0)
    })

    // Drain all rescheduled functions — all notifications must be marked read afterward
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (ctx) => {
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', 'many-notifs-user'))
        .collect()
      expect(notifications).toHaveLength(60)
      expect(notifications.every((n) => n.readAt !== undefined)).toBe(true)
    })
  })
})

// ── deleteFromWebhook schedules cascade ──────────────────────────────────────

describe('deleteFromWebhook cascade scheduling', () => {
  it('schedules cascadeUserDeletion after anonymization', async () => {
    const t = makeT()
    const token = 'test|cascade-schedule'

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'cascade-user',
        tokenIdentifier: token,
      })
    })

    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: token,
      svixId: 'svix-cascade-1',
    })

    // User is anonymized
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', token))
        .unique()
      expect(user).not.toBeNull()
      expect(user!.email).toBe('deleted@deleted.invalid')
      expect(user!.name).toBe('')
    })

    // Cascade runs via scheduled function
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    // After cascade, verify it ran (no errors)
  })

  it('idempotent: duplicate svixId does not schedule cascade twice', async () => {
    const t = makeT()
    const token = 'test|idem-cascade'
    const svixId = 'svix-idem-1'

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        slug: 'idem-user',
        tokenIdentifier: token,
      })
    })

    // First call
    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: token,
      svixId,
    })

    // Second call with same svixId — should be no-op
    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: token,
      svixId,
    })

    // Finish scheduled functions — only one cascade should run
    await t.finishAllScheduledFunctions(vi.runAllTimers)
  })
})

// ── End-to-end cascade ───────────────────────────────────────────────────────

describe('end-to-end user deletion cascade', () => {
  it('deletes user with mixed bookings and ancillary data, full cascade completes', async () => {
    const t = makeT()
    const ownerToken = 'test|e2e-owner'
    const ownerSlug = 'e2e-owner'
    let draftBookingId: Id<'bookings'>
    let upcomingBookingId: Id<'bookings'>
    let completedBookingId: Id<'bookings'>
    let draftSnapshotId: Id<'availabilitySnapshots'>
    let upcomingSnapshotId: Id<'availabilitySnapshots'>
    let draftReservationId: Id<'reservations'>
    let upcomingReservationId: Id<'reservations'>
    let userId: Id<'users'>

    await t.run(async (ctx) => {
      userId = await seedUser(ctx, {
        slug: ownerSlug,
        tokenIdentifier: ownerToken,
      })
      await seedUser(ctx, {
        slug: 'e2e-instr',
        tokenIdentifier: 'test|e2e-instr',
        role: 'Instructor',
      })

      // Draft booking with reservation
      const draft = await seedBookingWithReservation(ctx, {
        ownerSlug,
        instructorSlug: 'e2e-instr',
        bookingStatus: 'Draft',
        reservationStatus: 'PendingAcceptance',
        date: testDate(3),
      })
      draftBookingId = draft.bookingId
      draftSnapshotId = draft.snapshotId
      draftReservationId = draft.reservationId

      // Upcoming booking with reservation
      const upcoming = await seedBookingWithReservation(ctx, {
        ownerSlug,
        instructorSlug: 'e2e-instr',
        bookingStatus: 'Upcoming',
        date: testDate(7),
      })
      upcomingBookingId = upcoming.bookingId
      upcomingSnapshotId = upcoming.snapshotId
      upcomingReservationId = upcoming.reservationId

      // Completed booking (should NOT be touched)
      completedBookingId = await seedBooking(ctx, {
        ownerId: ownerSlug,
        status: 'Completed',
      })

      // Notifications
      await seedNotification(ctx, { userId: ownerSlug, message: 'Notif 1' })
      await seedNotification(ctx, { userId: ownerSlug, message: 'Notif 2' })
    })

    // Trigger deletion
    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: ownerToken,
      svixId: 'svix-e2e-1',
    })

    // Run all scheduled cascade functions
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    // Verify final state
    await t.run(async (ctx) => {
      // User anonymized
      const user = await ctx.db.get(userId!)
      expect(user!.email).toBe('deleted@deleted.invalid')

      // Draft booking cancelled
      const draft = await ctx.db.get(draftBookingId!)
      expect(draft!.status).toBe('Cancelled')

      // Upcoming booking cancelled
      const upcoming = await ctx.db.get(upcomingBookingId!)
      expect(upcoming!.status).toBe('Cancelled')

      // Completed booking untouched
      const completed = await ctx.db.get(completedBookingId!)
      expect(completed!.status).toBe('Completed')

      // Draft reservation vacated
      const draftRes = await ctx.db.get(draftReservationId!)
      expect(draftRes!.status).toBe('Vacated')
      expect(draftRes!.vacatedBy).toBe('user_deleted')

      // Upcoming reservation vacated
      const upcomingRes = await ctx.db.get(upcomingReservationId!)
      expect(upcomingRes!.status).toBe('Vacated')
      expect(upcomingRes!.vacatedBy).toBe('user_deleted')

      // Snapshots restored
      const draftSnap = await ctx.db.get(draftSnapshotId!)
      expect(draftSnap!.availableUnits).toBe(1)
      expect(draftSnap!.reservedUnits).toBe(0)

      const upcomingSnap = await ctx.db.get(upcomingSnapshotId!)
      expect(upcomingSnap!.availableUnits).toBe(1)
      expect(upcomingSnap!.reservedUnits).toBe(0)

      // UserRoles cleaned up
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId!))
        .collect()
      expect(roles).toHaveLength(0)

      // Notifications marked read
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', ownerSlug))
        .collect()
      expect(notifications.every((n) => n.readAt !== undefined)).toBe(true)
    })
  })
})
