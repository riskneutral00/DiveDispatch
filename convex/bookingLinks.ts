import { ConvexError, v } from 'convex/values'
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { authorize, requireAuth, assertOwnership } from './lib/auth'
import { isBookingExpired } from './bookings/_shared'
import { ErrorCode } from './lib/errorCodes'
import { BOOKING_LINK_TTL_MS } from './lib/timeConstants'
import { BOOKING_STATUS } from './shared/statuses'
import { todayISO } from './bookings/stateMachine'

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
  | { status: 'completed'; customerName: string; operatorName: string; startDate: string }
  | { status: 'post_trip'; operatorName: string; startDate: string; endDate: string }
  | { status: 'expired' }
  | { status: 'closed' }
  | { status: 'not_found' }

export type BookingLinkInfo = {
  token: string
  expiresAt: number
  customerName: string
  email: string
}

export async function _getByBookingId(
  ctx: QueryCtx,
  args: { bookingId: string },
): Promise<BookingLinkInfo | null> {
  const { user } = await requireAuth(ctx)
  const booking = await ctx.db.get(args.bookingId as Id<"bookings">)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  assertOwnership(booking, user)

  const links = await ctx.db
    .query('bookingLinks')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId as Id<"bookings">))
    .collect() // bounded: per-booking links, max ~20 customers

  const now = Date.now()
  const valid = links.find((l) => (l.expiresAt as number) > now)
  if (!valid) return null

  return {
    token: valid.token as string,
    expiresAt: valid.expiresAt as number,
    customerName: valid.customerName as string,
    email: valid.email as string,
  }
}

type CreateLinkChannel =
  | 'whatsapp'
  | 'line'
  | 'email'
  | 'sms'

export async function _createLink(
  ctx: MutationCtx,
  args: {
    bookingId: string
    customerName: string
    email: string
    channel?: CreateLinkChannel
  },
): Promise<string> {
  const booking = await ctx.db.get(args.bookingId as Id<"bookings">)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  await authorize(ctx, null, 'booking:manage', { type: 'booking', ownerId: booking.ownerId })

  const links = await ctx.db
    .query('bookingLinks')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId as Id<"bookings">))
    .collect() // bounded: per-booking links, max ~20 customers

  const now = Date.now()
  const existing = links.find((l) => (l.expiresAt as number) > now && !(l.usedAt))
  if (existing) {
    if (args.channel && existing.channel !== args.channel) {
      await ctx.db.patch(existing._id, { channel: args.channel })
    }
    return existing.token as string
  }

  const token = crypto.randomUUID()
  const expiresAt = now + BOOKING_LINK_TTL_MS

  await ctx.db.insert('bookingLinks', {
    bookingId: args.bookingId as Id<"bookings">,
    token,
    expiresAt,
    customerName: args.customerName,
    email: args.email,
    ...(args.channel ? { channel: args.channel } : {}),
  })

  const existingProfile = await ctx.db
    .query('customerProfiles')
    .withIndex('by_linkToken', (q) => q.eq('linkToken', token))
    .unique()

  if (!existingProfile) {
    await ctx.db.insert('customerProfiles', {
      bookingId: args.bookingId as Id<"bookings">,
      linkToken: token,
    })
  }

  return token
}

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<BookingLinkResult> => {
    const link = await ctx.db
      .query('bookingLinks')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!link) return { status: 'not_found' }

    if (link.expiresAt < Date.now()) {
      return { status: 'expired' }
    }

    const booking = await ctx.db.get(link.bookingId)
    if (!booking) return { status: 'not_found' }

    if (link.usedAt) {
      return {
        status: 'completed',
        customerName: link.customerName,
        operatorName: booking.operatorName,
        startDate: booking.startDate,
      }
    }

    if (isBookingExpired(booking)) {
      return { status: 'expired' }
    }

    const isPostTrip =
      booking.status === BOOKING_STATUS.Completed ||
      (booking.status === BOOKING_STATUS.Upcoming && booking.endDate < todayISO())
    if (isPostTrip) {
      return {
        status: 'post_trip',
        operatorName: booking.operatorName,
        startDate: booking.startDate,
        endDate: booking.endDate,
      }
    }

    if (booking.status !== BOOKING_STATUS.Draft) {
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

export const getByBookingId = query({
  args: { bookingId: v.id('bookings') },
  handler: _getByBookingId,
})

export const create = mutation({
  args: {
    bookingId: v.id('bookings'),
    customerName: v.string(),
    email: v.string(),
    channel: v.optional(v.union(v.literal('whatsapp'), v.literal('line'), v.literal('email'), v.literal('sms'))),
  },
  handler: async (ctx, args) => {
    return await _createLink(ctx, args)
  },
})

export const createBookingLink = mutation({
  args: {
    bookingId: v.id('bookings'),
    customerName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    return await _createLink(ctx, args)
  },
})
