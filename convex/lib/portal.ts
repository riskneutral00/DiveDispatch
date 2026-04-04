import { ConvexError } from 'convex/values'
import type { DbCtx } from './auth'
import type { Doc } from '../_generated/dataModel'
import { isBookingExpired } from '../bookings/_shared'
import { ErrorCode } from './errorCodes'
import { BOOKING_STATUS } from '../shared/statuses'

type PortalResult = { link: Doc<'bookingLinks'>; booking: Doc<'bookings'>; profile: Doc<'customerProfiles'> }

/**
 * Shared resolution steps: look up link, booking, profile.
 * Returns the resolved triple, or a string error code describing the failure.
 */
async function _resolveCore(ctx: DbCtx, token: string): Promise<PortalResult | string> {
  const link = await ctx.db
    .query('bookingLinks')
    .withIndex('by_token', (q) => q.eq('token', token))
    .unique()
  if (!link) return ErrorCode.TOKEN_EXPIRED
  if (link.expiresAt < Date.now()) return ErrorCode.TOKEN_EXPIRED
  if (link.usedAt) return ErrorCode.TOKEN_EXPIRED

  const booking = await ctx.db.get(link.bookingId)
  if (!booking) return ErrorCode.TOKEN_EXPIRED
  if (isBookingExpired(booking)) return ErrorCode.BOOKING_CLOSED
  if (booking.status !== BOOKING_STATUS.Draft) return ErrorCode.BOOKING_CLOSED

  const profile = await ctx.db
    .query('customerProfiles')
    .withIndex('by_linkToken', (q) => q.eq('linkToken', token))
    .unique()
  if (!profile) return ErrorCode.TOKEN_EXPIRED

  return { link, booking, profile }
}

/**
 * Validates a portal token and resolves link, booking, and customer profile.
 * Throws differentiated error codes: TOKEN_EXPIRED for link issues, BOOKING_CLOSED for status issues.
 * Use in mutations where token failure should abort.
 */
export async function resolvePortalToken(ctx: DbCtx, token: string): Promise<PortalResult> {
  const result = await _resolveCore(ctx, token)
  if (typeof result === 'string') throw new ConvexError({ code: result })
  return result
}

/**
 * Validates a portal token, returning null on any failure instead of throwing.
 * Use in queries where invalid tokens should yield null.
 */
export async function resolvePortalTokenSoft(ctx: DbCtx, token: string): Promise<PortalResult | null> {
  const result = await _resolveCore(ctx, token)
  return typeof result === 'string' ? null : result
}
