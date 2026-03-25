import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireAuth } from '../lib/auth'
import {
  canBookingTransition,
  releaseBookingReservations,
} from './_shared'
import { logBookingChange } from '../bookingAuditLog'
import { ErrorCode } from '../lib/errorCodes'

// ─── editBooking ──────────────────────────────────────────────────────────────

/**
 * Resets an Upcoming or Completed booking to Draft for editing.
 * Vacates all reservations, clears sessions, and marks bookingFormComplete false.
 */
export const editBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    if (!canBookingTransition(booking.status, 'edit')) {
      throw new ConvexError({
        code: ErrorCode.INVALID_STATUS,
        reason: `Cannot edit booking in status '${booking.status}'`,
      })
    }

    await releaseBookingReservations(ctx, args.bookingId, 'operator_edit')

    // Clear sessions so operator can re-submit with new session data
    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }

    await ctx.db.patch(args.bookingId, {
      status: 'Draft',
      bookingFormComplete: false,
      submittedAt: undefined,
      expiresAt: undefined,
    })

    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'edited',
      actorSlug: user.slug,
      actorType: 'operator',
      diff: JSON.stringify({ status: { old: booking.status, new: 'Draft' } }),
    })
  },
})
