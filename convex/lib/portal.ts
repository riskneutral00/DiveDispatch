import { ConvexError } from 'convex/values'
import type { AnyCtx } from './auth'
import { isBookingExpired } from '../bookings/_shared'

/**
 * Validates a portal token and resolves link, booking, and customer profile.
 * Throws on invalid/expired token, missing booking, non-Draft status, or missing profile.
 * Use in mutations where token failure should abort.
 */
export async function resolvePortalToken(ctx: AnyCtx, token: string) {
  const link = await ctx.db
    .query('bookingLinks')
    .withIndex('by_token', (q: AnyCtx) => q.eq('token', token))
    .unique()
  if (!link) throw new ConvexError({ code: 'TOKEN_EXPIRED' })
  if (link.expiresAt < Date.now()) throw new ConvexError({ code: 'TOKEN_EXPIRED' })
  if (link.usedAt) throw new ConvexError({ code: 'TOKEN_EXPIRED' })

  const booking = await ctx.db.get(link.bookingId)
  if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
  if (isBookingExpired(booking)) throw new ConvexError({ code: 'TOKEN_EXPIRED' })
  if (booking.status !== 'Draft') throw new ConvexError({ code: 'BOOKING_CLOSED' })

  const profile = await ctx.db
    .query('customerProfiles')
    .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', token))
    .unique()
  if (!profile) throw new ConvexError({ code: 'NOT_FOUND' })

  return { link, booking, profile }
}

/**
 * Validates a portal token, returning null on any failure instead of throwing.
 * Use in queries where invalid tokens should yield null.
 */
export async function resolvePortalTokenSoft(ctx: AnyCtx, token: string) {
  const link = await ctx.db
    .query('bookingLinks')
    .withIndex('by_token', (q: AnyCtx) => q.eq('token', token))
    .unique()
  if (!link) return null
  if (link.expiresAt < Date.now()) return null
  if (link.usedAt) return null

  const booking = await ctx.db.get(link.bookingId)
  if (!booking) return null
  if (isBookingExpired(booking)) return null
  if (booking.status !== 'Draft') return null

  const profile = await ctx.db
    .query('customerProfiles')
    .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', token))
    .unique()
  if (!profile) return null

  return { link, booking, profile }
}
