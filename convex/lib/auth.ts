import { ConvexError } from 'convex/values'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCtx = any

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
export async function requireAuth(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
  if (!user) throw new ConvexError({ code: 'NOT_FOUND' })

  return { identity, user }
}

/**
 * Resolves the authenticated user, returning null if unauthenticated or unprovisioned.
 * Use in queries where unauthenticated callers should get null.
 */
export async function getAuthUser(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
}
