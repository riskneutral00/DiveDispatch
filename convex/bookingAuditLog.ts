import { v } from 'convex/values'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { requireAuth, requireOwnerOrResourceAccess } from './lib/auth'

export type { AuditAction, AuditActorType, LogBookingChangeArgs } from './lib/auditLog'
export { logBookingChange } from './lib/auditLog'

export const getAuditLog = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    await requireOwnerOrResourceAccess(ctx, user, args.bookingId)

    return ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId_timestamp', (q) =>
        q.eq('bookingId', args.bookingId),
      )
      .order('desc')
      .take(100)
  },
})
