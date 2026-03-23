import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation } from '../_generated/server'
import { requireAuth } from '../lib/auth'
import {
  canBookingTransition,
  releaseBookingReservations,
  isSessionEnded,
  isBookingExpired,
  tryAutoAdvance,
} from './_shared'
import { logBookingChange } from '../bookingAuditLog'
import { notify } from '../notifications'

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
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

    if (!canBookingTransition(booking.status, 'cancel')) {
      throw new ConvexError({
        code: 'INVALID_STATUS',
        reason: `Cannot cancel booking in status '${booking.status}'`,
      })
    }

    await releaseBookingReservations(ctx, args.bookingId, 'booking_cancelled')
    await ctx.db.patch(args.bookingId, { status: 'Cancelled' })
    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'cancelled',
      actorSlug: user.slug,
      actorType: 'operator',
    })
  },
})

// ─── TTL expiry (lazy, client-triggered) ──────────────────────────────────────

/**
 * Expires a single Draft booking whose holdTTL has lapsed.
 * Called by the client (via useBookingWithExpiry hook) on lazy read.
 * Idempotent: no-op if the booking is already Cancelled or not expired.
 * Preserves sessions, links, and customerProfiles for audit trail.
 * Transaction order: vacate reservations → restore snapshots → set status Cancelled.
 */
export const expireBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    if (!isBookingExpired(booking)) return

    await releaseBookingReservations(ctx, args.bookingId, 'hold_expired')
    await ctx.db.patch(args.bookingId, { status: 'Cancelled' })
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
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

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
      type: 'medical_cleared',
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

// ─── completeBookings ────────────────────────────────────────────────────────

/**
 * Cron: auto-complete Upcoming bookings whose last session has ended.
 * Runs hourly. Uses timezone-aware comparison via Intl.DateTimeFormat.
 * Batch limit: 100 per run.
 */
export const completeBookings = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ completed: number; more: boolean }> => {
    const upcoming = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q) => q.eq('status', 'Upcoming'))
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
        await ctx.db.patch(booking._id, { status: 'Completed' })
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
  },
})
