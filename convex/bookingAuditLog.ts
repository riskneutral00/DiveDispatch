import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import { authorize } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'

export type { AuditAction, AuditActorType, LogBookingChangeArgs } from './lib/auditLog'
export { logBookingChange } from './lib/auditLog'

export const getAuditLog = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'booking_not_found' })
    await authorize(ctx, null, 'booking:read', {
      type: 'booking',
      id: args.bookingId,
      ownerId: booking.ownerId,
    })

    return ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId_timestamp', (q) =>
        q.eq('bookingId', args.bookingId),
      )
      .order('desc')
      .take(100)
  },
})
