import { ConvexError, v } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { internalMutation, mutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { requireAuth, assertOwnership, requireOwnerOrResourceAccess } from '../lib/auth'
import {
  canBookingTransition,
  releaseBookingReservations,
  isSessionEnded,
  isBookingExpired,
  tryAutoAdvance,
} from './_shared'
import { logBookingChange } from '../lib/auditLog'
import { notify, notifyReleasedInventory } from '../notifications'
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

    const vacated = await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.BookingCancelled)

    // Notify resource stakeholders whose inventory was just released
    await notifyReleasedInventory(ctx, args.bookingId, vacated)

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

/** Vacate reservations → set Cancelled → audit log. Shared by both expiry mutations. */
async function performExpiry(ctx: MutationCtx, bookingId: Id<'bookings'>) {
  await releaseBookingReservations(ctx, bookingId, VACATED_REASON.HoldExpired)
  await ctx.db.patch(bookingId, { status: BOOKING_STATUS.Cancelled })
  await logBookingChange(ctx, {
    bookingId,
    action: 'expired',
    actorSlug: 'system',
    actorType: 'system',
  })
}

/**
 * Expires a single Draft booking whose holdTTL has lapsed.
 * Internal only — called by cron purgeExpiredDrafts.
 * Idempotent: no-op if booking is already Cancelled or not expired.
 */
export const expireBooking = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    if (!isBookingExpired(booking)) return
    await performExpiry(ctx, args.bookingId)
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
    await requireOwnerOrResourceAccess(ctx, user, args.bookingId)

    await performExpiry(ctx, args.bookingId)
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
        await ctx.db.patch(profile._id, { physicianClearanceRequired: false }) // batch-exempt: conditional per-profile write, profiles are small (<10 per booking)
      }

      if (profile.customerId) {
        const customer = await ctx.db.get(profile.customerId) // batch-exempt: conditional per-profile lookup, profiles are small (<10 per booking)
        if (customer) {
          const flags = customer.flags ?? []
          if (flags.includes('medical_block')) {
            await ctx.db.patch(profile.customerId, { // batch-exempt: conditional per-customer flag patch
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

// ─── Shared completion logic ─────────────────────────────────────────────────

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

  const sessionsByBooking = await Promise.all(
    batch.map((b) =>
      ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', b._id))
        .collect(),
    ),
  )

  for (let i = 0; i < batch.length; i++) {
    const booking = batch[i]
    const sessions = sessionsByBooking[i]

    if (sessions.length === 0) continue

    const last = sessions.reduce((latest, s) => {
      if (s.date > latest.date) return s
      if (s.date === latest.date && s.endTime > latest.endTime) return s
      return latest
    })

    if (isSessionEnded(last.date, last.endTime, last.timezone)) {
      await ctx.db.patch(booking._id, { status: BOOKING_STATUS.Completed }) // batch-exempt: conditional per-booking
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
