/**
 * DEV-ONLY mutations for manual testing.
 * Allows simulating customer portal completion so the full booking lifecycle
 * can be tested before the portal is live.
 */

import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireAuth } from '../lib/auth'
import { tryAutoAdvance } from './autoAdvance'
import { ErrorCode } from '../lib/errorCodes'

/**
 * DEV-ONLY: Marks a booking's customer form as complete and triggers auto-advance.
 * Simulates "all customers submitted their portal forms" so Draft → Upcoming
 * can proceed without the customer portal being live.
 */
export const forceCustomerFormComplete = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    if (process.env.ENVIRONMENT !== 'development') {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, message: 'Dev-only mutation' })
    }

    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    if (booking.customerFormComplete) return // already done

    await ctx.db.patch(args.bookingId, { customerFormComplete: true })
    await tryAutoAdvance(ctx, args.bookingId)
  },
})
