import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, type AnyCtx } from './lib/auth'
import { isBookingExpired } from './bookings/_shared'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  | { status: 'completed'; customerName: string; operatorName: string; startDate: string }
  | { status: 'expired' }
  | { status: 'closed' }
  | { status: 'not_found' }

export type BookingLinkInfo = {
  token: string
  expiresAt: number
  customerName: string
  email: string
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAuthAndOwnership(
  ctx: AnyCtx,
  bookingId: string,
): Promise<AnyCtx> {
  const { user } = await requireAuth(ctx)

  const booking = await ctx.db.get(bookingId)
  if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
  if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  return booking
}

// ─── Handlers (exported for unit testing) ────────────────────────────────────

/**
 * Returns the first non-expired booking link for a booking, or null.
 * Auth: caller slug must match booking.ownerId.
 */
export async function _getByBookingId(
  ctx: AnyCtx,
  args: { bookingId: string },
): Promise<BookingLinkInfo | null> {
  await requireAuthAndOwnership(ctx, args.bookingId)

  const links = await ctx.db
    .query('bookingLinks')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
    .collect()

  const now = Date.now()
  const valid = links.find((l: AnyCtx) => (l.expiresAt as number) > now)
  if (!valid) return null

  return {
    token: valid.token as string,
    expiresAt: valid.expiresAt as number,
    customerName: valid.customerName as string,
    email: valid.email as string,
  }
}

/**
 * Creates a portal booking link for a booking.
 * Returns the existing token if a non-expired link already exists (idempotent).
 * Auth: caller slug must match booking.ownerId.
 */
export async function _createLink(
  ctx: AnyCtx,
  args: { bookingId: string; customerName: string; email: string },
): Promise<string> {
  await requireAuthAndOwnership(ctx, args.bookingId)

  // Return existing valid link rather than creating duplicates
  const links = await ctx.db
    .query('bookingLinks')
    .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
    .collect()

  const now = Date.now()
  const existing = links.find((l: AnyCtx) => (l.expiresAt as number) > now && !(l.usedAt))
  if (existing) return existing.token as string

  // Create new link — 30-day TTL
  const token = crypto.randomUUID()
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000

  await ctx.db.insert('bookingLinks', {
    bookingId: args.bookingId,
    token,
    expiresAt,
    customerName: args.customerName,
    email: args.email,
  })

  return token
}

// ─── Convex exports ───────────────────────────────────────────────────────────

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

    // Token already used — customer completed portal submission.
    if (link.usedAt) {
      return {
        status: 'completed',
        customerName: link.customerName,
        operatorName: booking.operatorName,
        startDate: booking.startDate,
      }
    }

    // Booking TTL has lapsed — lazy expiry detected on read.
    if (isBookingExpired(booking)) {
      return { status: 'expired' }
    }

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

export const getByBookingId = query({
  args: { bookingId: v.id('bookings') },
  handler: _getByBookingId,
})

export const create = mutation({
  args: {
    bookingId: v.id('bookings'),
    customerName: v.string(),
    email: v.string(),
  },
  handler: _createLink,
})

/**
 * Creates a portal booking link and atomically provisions the customer profile slot.
 *
 * Idempotent: returns existing token if a valid link already exists and reuses
 * the existing profile if present. The customerProfile is created empty — each
 * portal step mutation (savePortalContact, saveMedicalAnswers, etc.) fills it in.
 *
 * Auth: caller slug must match booking.ownerId (Clerk auth required).
 */
export const createBookingLink = mutation({
  args: {
    bookingId: v.id('bookings'),
    customerName: v.string(),
    email: v.string(),
  },
  handler: async (
    ctx: AnyCtx,
    args: { bookingId: string; customerName: string; email: string },
  ): Promise<string> => {
    await requireAuthAndOwnership(ctx, args.bookingId)

    // Return existing valid link rather than creating duplicates
    const links = await ctx.db
      .query('bookingLinks')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect()

    const now = Date.now()
    const existing = links.find((l: AnyCtx) => (l.expiresAt as number) > now && !(l.usedAt))

    let token: string
    if (existing) {
      token = existing.token as string
    } else {
      // Create new link — 30-day TTL
      token = crypto.randomUUID()
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000

      await ctx.db.insert('bookingLinks', {
        bookingId: args.bookingId,
        token,
        expiresAt,
        customerName: args.customerName,
        email: args.email,
      })
    }

    // Atomically ensure customerProfile slot exists for this token
    const existingProfile = await ctx.db
      .query('customerProfiles')
      .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', token))
      .unique()

    if (!existingProfile) {
      await ctx.db.insert('customerProfiles', {
        bookingId: args.bookingId,
        linkToken: token,
      })
    }

    return token
  },
})
