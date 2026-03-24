import { v } from 'convex/values'
import { query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireAuth } from './lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'created'
  | 'submitted'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'completed'
  | 'edited'
  | 'reservation_accepted'
  | 'reservation_declined'
  | 'portal_submitted'
  | 'medical_blocked'
  | 'medical_cleared'
  | 'noshow_marked'
  | 'noshow_reverted'

export type AuditActorType = 'operator' | 'resource' | 'customer' | 'system'

export type LogBookingChangeArgs = {
  bookingId: string
  action: AuditAction
  actorSlug: string
  actorType: AuditActorType
  diff?: string
  note?: string
}

// ─── logBookingChange ─────────────────────────────────────────────────────────

/**
 * Plain helper — call directly inside a mutation to write an audit entry
 * in the same transaction as the state change. Not exposed to the client.
 *
 * Signature mirrors other shared helpers (releaseBookingReservations, tryAutoAdvance).
 */
export async function logBookingChange(
  ctx: MutationCtx,
  args: LogBookingChangeArgs,
): Promise<void> {
  await ctx.db.insert('bookingAuditLog', {
    bookingId: args.bookingId as Id<"bookings">,
    action: args.action,
    actorSlug: args.actorSlug,
    actorType: args.actorType,
    timestamp: Date.now(),
    diff: args.diff,
    note: args.note,
  })
}

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
