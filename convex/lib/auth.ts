import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import type { UserIdentity } from 'convex/server'
import { ErrorCode } from './errorCodes'

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
