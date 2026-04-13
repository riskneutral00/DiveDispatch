import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

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
  | 'referral_handoff'
  | 'referral_returned'

export type AuditActorType = 'operator' | 'resource' | 'customer' | 'system'

export type LogBookingChangeArgs = {
  bookingId: Id<'bookings'>
  action: AuditAction
  actorSlug: string
  actorType: AuditActorType
  diff?: string
  note?: string
}

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
