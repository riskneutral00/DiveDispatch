import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation } from '../_generated/server'
import { requireAuth } from '../lib/auth'
import {
  type AnyCtx,
  canBookingTransition,
  releaseBookingReservations,
  isSessionEnded,
} from './_shared'

// ─── cancelBooking ────────────────────────────────────────────────────────────

/**
 * Cancels a booking from any non-Cancelled status.
 * Vacates all active reservations and marks booking Cancelled. Irreversible.
 */
export const cancelBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx: AnyCtx, args: { bookingId: string }) => {
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
  },
})

// ─── TTL expiry cron ──────────────────────────────────────────────────────────

/**
 * Cron: expire Draft bookings whose holdTTL has lapsed.
 * Runs every 15 minutes. Vacates reservations then hard-deletes the booking.
 * Batch limit: 100 per run.
 */
export const expireHolds = internalMutation({
  args: {},
  handler: async (ctx: AnyCtx): Promise<{ expired: number; more: boolean }> => {
    const now = Date.now()

    const drafts = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q: AnyCtx) => q.eq('status', 'Draft'))
      .collect()

    const expired = drafts.filter(
      (b: AnyCtx) => b.expiresAt != null && b.expiresAt < now,
    )

    const batch = expired.slice(0, 100)
    const more = expired.length > 100

    for (const booking of batch) {
      await releaseBookingReservations(ctx, booking._id, 'hold_expired')

      const sessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', booking._id))
        .collect()
      for (const session of sessions) {
        await ctx.db.delete(session._id)
      }

      const links = await ctx.db
        .query('bookingLinks')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', booking._id))
        .collect()
      for (const link of links) {
        await ctx.db.delete(link._id)
      }

      await ctx.db.delete(booking._id)
    }

    return { expired: batch.length, more }
  },
})

/**
 * Cron: auto-complete Upcoming bookings whose last session has ended.
 * Runs hourly. Uses timezone-aware comparison via Intl.DateTimeFormat.
 * Batch limit: 100 per run.
 */
export const completeBookings = internalMutation({
  args: {},
  handler: async (ctx: AnyCtx): Promise<{ completed: number; more: boolean }> => {
    const upcoming = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q: AnyCtx) => q.eq('status', 'Upcoming'))
      .collect()

    const batch = upcoming.slice(0, 100)
    const more = upcoming.length > 100
    let completed = 0

    for (const booking of batch) {
      const sessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', booking._id))
        .collect()

      if (sessions.length === 0) continue

      // Last session = max date, then max endTime (both YYYY-MM-DD / HH:MM are lex-sortable)
      const last = sessions.reduce((latest: AnyCtx, s: AnyCtx) => {
        if (s.date > latest.date) return s
        if (s.date === latest.date && s.endTime > latest.endTime) return s
        return latest
      })

      if (isSessionEnded(last.date, last.endTime, last.timezone)) {
        await ctx.db.patch(booking._id, { status: 'Completed' })
        completed++
      }
    }

    return { completed, more }
  },
})
