import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { UserIdentity } from 'convex/server'
import { ErrorCode } from './errorCodes'

/**
 * Asserts that a resource's ownerId matches the user's slug.
 * Throws ConvexError with FORBIDDEN if ownership does not match.
 * Replaces inline `if (resource.ownerId !== user.slug) throw ...` checks.
 */
export function assertOwnership(
  resource: { ownerId: string },
  user: { slug: string },
  errorMessage?: string,
): void {
  if (resource.ownerId !== user.slug) {
    throw new ConvexError(
      errorMessage
        ? { code: ErrorCode.FORBIDDEN, reason: errorMessage }
        : { code: ErrorCode.FORBIDDEN },
    )
  }
}

/**
 * Shared context type for functions that need db + auth but work in both
 * query and mutation handlers. Prefer QueryCtx or MutationCtx directly
 * when the handler type is known.
 */
export type DbCtx = QueryCtx | MutationCtx

/** Roles that can create and own bookings. */
export const OPERATOR_ROLE_SET = new Set([
  'DiveCenter',
  'Agent',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
])

/** Default hold TTL: 12 hours. */
export const HOLD_TTL_MS = 43200000

/**
 * Resolves the authenticated user. Throws UNAUTHENTICATED or NOT_FOUND.
 * Use in mutations where auth is mandatory.
 */
export async function requireAuth(ctx: DbCtx): Promise<{ identity: UserIdentity; user: Doc<'users'> }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
  if (!user) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  return { identity, user }
}

/**
 * Resolves the authenticated user, returning null if unauthenticated or unprovisioned.
 * Use in queries where unauthenticated callers should get null.
 */
export async function getAuthUser(ctx: DbCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
}

/**
 * Verifies that a user either owns the booking (ownerId match) or has a
 * reservation on it via their inventory units. Throws FORBIDDEN if neither.
 * Use in query/mutation handlers where both the booking owner and assigned
 * resource stakeholders need access.
 */
export async function requireOwnerOrResourceAccess(
  ctx: QueryCtx,
  user: { slug: string },
  bookingId: string | Id<'bookings'>,
): Promise<void> {
  const booking = await ctx.db.get(bookingId as Id<'bookings'>)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  if (booking.ownerId === user.slug) return

  const callerUnits = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', user.slug))
    .collect()
  const callerUnitIds = new Set(callerUnits.map((u) => u._id))
  const bookingReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()
  const hasReservation = bookingReservations.some((r) => callerUnitIds.has(r.inventoryUnitId))
  if (!hasReservation) throw new ConvexError({ code: ErrorCode.FORBIDDEN })
}
