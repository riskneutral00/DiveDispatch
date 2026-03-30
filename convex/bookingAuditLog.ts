import { v } from 'convex/values'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { requireAuth } from './lib/auth'

// Re-export shared types and helper so external consumers (e.g. tests, admin tools)
// can import from this module without knowing the lib layout.
export type { AuditAction, AuditActorType, LogBookingChangeArgs } from './lib/auditLog'
export { logBookingChange } from './lib/auditLog'

// ─── getAuditLog ──────────────────────────────────────────────────────────────

/**
 * Returns audit entries for a booking, sorted by timestamp descending.
 * Capped at 100 entries. Requires authentication.
 */
export const getAuditLog = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    return ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId_timestamp', (q) =>
        q.eq('bookingId', args.bookingId),
      )
      .order('desc')
      .take(100)
  },
})
