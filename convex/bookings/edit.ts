import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { authorize } from '../lib/auth'
import {
  canBookingTransition,
  releaseBookingReservations,
} from './_shared'
import { logBookingChange } from '../lib/auditLog'
import { batchDelete } from '../lib/batch'
import { ErrorCode } from '../lib/errorCodes'
import { notifyReleasedInventory } from '../notifications'
import { checkIdempotency } from '../lib/idempotency'
import { BOOKING_STATUS, VACATED_REASON } from '../shared/statuses'

export const editBooking = mutation({
  args: {
    bookingId: v.id('bookings'),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    const { user } = await authorize(ctx, null, 'booking:manage', {
      type: 'booking', id: args.bookingId, ownerId: booking.ownerId,
    })

    if (args.idempotencyKey) {
      const isDuplicate = await checkIdempotency(ctx, args.idempotencyKey, 'editBooking')
      if (isDuplicate) return
    }

    if (!canBookingTransition(booking.status, 'edit')) {
      throw new ConvexError({
        code: ErrorCode.INVALID_STATUS,
        reason: `Cannot edit booking in status '${booking.status}'`,
      })
    }

    const vacated = await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.OperatorEdit)
    await notifyReleasedInventory(ctx, args.bookingId, vacated)

    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking resources
    await batchDelete(ctx, sessions)

    await ctx.db.patch(args.bookingId, { // fsm-ok
      status: BOOKING_STATUS.Draft,
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
