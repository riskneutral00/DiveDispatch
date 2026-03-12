import { v } from 'convex/values'
import { query } from './_generated/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

// Discriminated union returned by getByToken so the client can route
// without try/catch around useQuery.
export type BookingLinkResult =
  | {
      status: 'valid'
      bookingId: string
      customerName: string
      email: string
      operatorName: string
      activityType: string[]
      startDate: string
      endDate: string
      diverCount: number
    }
  | { status: 'expired' }
  | { status: 'closed' }
  | { status: 'not_found' }

// Public query — no Clerk auth required. Token IS the credential.
// Returns a discriminated union rather than throwing so the client
// can redirect/render without wrapping in an error boundary.
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx: AnyCtx, args: { token: string }): Promise<BookingLinkResult> => {
    const link = await ctx.db
      .query('bookingLinks')
      .withIndex('by_token', (q: AnyCtx) => q.eq('token', args.token))
      .unique()

    if (!link) return { status: 'not_found' }

    if (link.expiresAt < Date.now()) {
      return { status: 'expired' }
    }

    const booking = await ctx.db.get(link.bookingId)
    if (!booking) return { status: 'not_found' }

    // Booking closed means the portal should not accept new submissions.
    if (booking.status !== 'Draft') {
      return { status: 'closed' }
    }

    return {
      status: 'valid',
      bookingId: link.bookingId,
      customerName: link.customerName,
      email: link.email,
      operatorName: booking.operatorName,
      activityType: booking.activityType,
      startDate: booking.startDate,
      endDate: booking.endDate,
      diverCount: booking.divers.length,
    }
  },
})
