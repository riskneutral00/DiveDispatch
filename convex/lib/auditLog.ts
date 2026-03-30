import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

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
  | 'expired_draft_purged'
  | 'user_deleted_cascade'

export type AuditActorType = 'operator' | 'resource' | 'customer' | 'system'

export type LogBookingChangeArgs = {
  bookingId: Id<'bookings'>
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
    bookingId: args.bookingId,
    action: args.action,
    actorSlug: args.actorSlug,
    actorType: args.actorType,
    timestamp: Date.now(),
    diff: args.diff,
    note: args.note,
  })
}
