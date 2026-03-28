import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { requireAuth, assertOwnership } from '../lib/auth'
import {
  canBookingTransition,
  releaseBookingReservations,
  isSessionEnded,
  isBookingExpired,
  tryAutoAdvance,
} from './_shared'
import { logBookingChange } from '../bookingAuditLog'
import { notify } from '../notifications'
import { ErrorCode } from '../lib/errorCodes'
import { BOOKING_STATUS, NOTIFICATION_TYPE, VACATED_REASON } from '../shared/statuses'

// ─── cancelBooking ────────────────────────────────────────────────────────────

/**
 * Cancels a booking from any non-Cancelled status.
 * Vacates all active reservations and marks booking Cancelled. Irreversible.
 */
export const cancelBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    assertOwnership(booking, user)

    if (!canBookingTransition(booking.status, 'cancel')) {
      throw new ConvexError({
        code: ErrorCode.INVALID_STATUS,
        reason: `Cannot cancel booking in status '${booking.status}'`,
      })
    }

    await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.BookingCancelled)
    await ctx.db.patch(args.bookingId, { status: BOOKING_STATUS.Cancelled })
    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'cancelled',
      actorSlug: user.slug,
      actorType: 'operator',
    })
  },
})

// ─── TTL expiry (lazy, server-side) ───────────────────────────────────────────

/**
 * Expires a single Draft booking whose holdTTL has lapsed.
 * Internal only — not callable from the client.
 * Idempotent: no-op if the booking is already Cancelled or not expired.
 * Preserves sessions, links, and customerProfiles for audit trail.
 * Transaction order: vacate reservations → restore snapshots → set status Cancelled.
 */
export const expireBooking = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    if (!isBookingExpired(booking)) return

    await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.HoldExpired)
    await ctx.db.patch(args.bookingId, { status: BOOKING_STATUS.Cancelled })
    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'expired',
      actorSlug: 'system',
      actorType: 'system',
    })
  },
})

/**
 * Authenticated lazy-expiry trigger.
 * Called by the client (via useBookingWithExpiry hook) when it detects an expired Draft.
 * Validates caller ownership or reservation access, then performs the expiry inline.
 * Idempotent: no-op if booking is not expired.
 */
export const checkAndExpireBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    if (!isBookingExpired(booking)) return

    // Verify caller has access: owns the booking or has a reservation on it
    if (booking.ownerId !== user.slug) {
      const callerUnits = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', user.slug))
        .collect()
      const callerUnitIds = new Set(callerUnits.map((u) => u._id))
      const bookingReservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
        .collect()
      const hasReservation = bookingReservations.some((r) => callerUnitIds.has(r.inventoryUnitId))
      if (!hasReservation) throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    // Perform expiry inline (same logic as internalMutation expireBooking)
    await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.HoldExpired)
    await ctx.db.patch(args.bookingId, { status: BOOKING_STATUS.Cancelled })
    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'expired',
      actorSlug: 'system',
      actorType: 'system',
    })
  },
})

// ─── clearMedicalBlock ───────────────────────────────────────────────────────

/**
 * Operator lifts a medical hard block after reviewing physician clearance.
 *
 * Auth: Clerk-authenticated. Caller must own the booking (ownerId === user.slug).
 * Idempotent: no-op when medicalHardBlock is already false.
 *
 * Transaction order (all-or-nothing):
 *  1. Reset physicianClearanceRequired on all linked customerProfiles
 *  2. Remove 'medical_block' flag from linked customer records
 *  3. Clear medicalHardBlock on the booking (last — ensures profiles are clean first)
 *  4. Notify booking owner
 *  5. Write 'medical_cleared' audit log entry
 *  6. Call tryAutoAdvance (may promote Draft → Upcoming)
 *
 * Note: Does NOT reset or shorten expiresAt. The extended hold TTL set when
 * the medical block was activated remains in effect.
 */
export const clearMedicalBlock = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    assertOwnership(booking, user)

    // Idempotent: already cleared — nothing to do
    if (!booking.medicalHardBlock) return

    // 1-2. Reset physician clearance + remove flags on all linked profiles FIRST
    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()

    for (const profile of profiles) {
      if (profile.physicianClearanceRequired) {
        await ctx.db.patch(profile._id, { physicianClearanceRequired: false })
      }

      if (profile.customerId) {
        const customer = await ctx.db.get(profile.customerId)
        if (customer) {
          const flags = customer.flags ?? []
          if (flags.includes('medical_block')) {
            await ctx.db.patch(profile.customerId, {
              flags: flags.filter((f) => f !== 'medical_block') as ('medical_block')[],
            })
          }
        }
      }
    }

    // 3. Clear the block on the booking (after profiles are clean)
    await ctx.db.patch(args.bookingId, { medicalHardBlock: false })

    // 4. Notify booking owner
    await notify(ctx, {
      userId: booking.ownerId,
      type: NOTIFICATION_TYPE.MedicalCleared,
      bookingId: args.bookingId,
      message: 'Medical block cleared: physician clearance reviewed and approved.',
    })

    // 5. Audit trail
    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'medical_cleared',
      actorSlug: user.slug,
      actorType: 'operator',
    })

    // 6. May promote Draft → Upcoming now that the block is lifted
    await tryAutoAdvance(ctx, args.bookingId)
  },
})

// ─── expireStaleBookings (cron) ──────────────────────────────────────────────

/**
 * Cron: batch-expire Draft bookings whose holdTTL has lapsed.
 * Runs every 2 hours. Belt-and-suspenders to catch bookings the lazy client
 * check (useBookingWithExpiry) never triggered.
 *
 * Batch limit: take(50) per run to stay within Convex limits.
 * Idempotent: expireBooking() is a no-op for already-Cancelled bookings.
 */
export const expireStaleBookings = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ expired: number }> => {
    const now = Date.now()

    const staleDrafts = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q) => q.eq('status', BOOKING_STATUS.Draft))
      .filter((q) => q.and(
        q.neq(q.field('expiresAt'), undefined),
        q.lt(q.field('expiresAt'), now),
      ))
      .take(50)

    for (const booking of staleDrafts) {
      await ctx.runMutation(internal.bookings.status.expireBooking, { bookingId: booking._id })
    }

    return { expired: staleDrafts.length }
  },
})

// ─── Shared completion logic ─────────────────────────────────────────────────

import type { MutationCtx } from '../_generated/server'

async function runCompletionBatch(
  ctx: MutationCtx,
): Promise<{ completed: number; more: boolean }> {
  const upcoming = await ctx.db
    .query('bookings')
    .withIndex('by_status', (q) => q.eq('status', BOOKING_STATUS.Upcoming))
    .take(101)

  const batch = upcoming.slice(0, 100)
  const more = upcoming.length > 100
  let completed = 0

  for (const booking of batch) {
    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
      .collect()

    if (sessions.length === 0) continue

    // Last session = max date, then max endTime (both YYYY-MM-DD / HH:MM are lex-sortable)
    const last = sessions.reduce((latest, s) => {
      if (s.date > latest.date) return s
      if (s.date === latest.date && s.endTime > latest.endTime) return s
      return latest
    })

    if (isSessionEnded(last.date, last.endTime, last.timezone)) {
      await ctx.db.patch(booking._id, { status: BOOKING_STATUS.Completed })
      await logBookingChange(ctx, {
        bookingId: booking._id,
        action: 'completed',
        actorSlug: 'system',
        actorType: 'system',
      })
      completed++
    }
  }

  return { completed, more }
}

// ─── completeBookings ────────────────────────────────────────────────────────

/**
 * Cron: auto-complete Upcoming bookings whose last session has ended.
 * Runs hourly. Uses timezone-aware comparison via Intl.DateTimeFormat.
 * Batch limit: 100 per run.
 */
export const completeBookings = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ completed: number; more: boolean }> => {
    return runCompletionBatch(ctx)
  },
})

// ─── completeBookingsWithMonitoring ──────────────────────────────────────────

/**
 * Monitored wrapper for completeBookings.
 * Logs every execution to cronRunLog; alerts on failure.
 * Called by the cron scheduler instead of completeBookings directly.
 */
export const completeBookingsWithMonitoring = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    try {
      const result = await runCompletionBatch(ctx)

      // Schedule continuation if more bookings remain (DD-158)
      if (result.more) {
        await ctx.scheduler.runAfter(0, internal.bookings.status.completeBookingsWithMonitoring, {})
      }

      // Log success
      await ctx.db.insert('cronRunLog', {
        jobName: 'complete-bookings',
        status: 'success',
        runAt: Date.now(),
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Log failure
      await ctx.db.insert('cronRunLog', {
        jobName: 'complete-bookings',
        status: 'failure',
        error: errorMessage,
        runAt: Date.now(),
      })

      // Schedule alert email
      await ctx.scheduler.runAfter(0, internal.lib.alerts.sendAlertEmail, {
        jobName: 'complete-bookings',
        error: errorMessage,
      })

      // Re-throw so Convex marks the run as failed
      throw err
    }
  },
})
