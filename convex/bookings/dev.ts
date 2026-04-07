import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireAuth, assertOwnership } from '../lib/auth'
import { tryAutoAdvance } from './autoAdvance'
import { ErrorCode } from '../lib/errorCodes'
import { requireDevEnvironment } from '../lib/devGuard'

export const forceCustomerFormComplete = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    requireDevEnvironment()

    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    assertOwnership(booking, user)

    if (booking.customerFormComplete) return // already done

    await ctx.db.patch(args.bookingId, { customerFormComplete: true })
    await tryAutoAdvance(ctx, args.bookingId)
  },
})
