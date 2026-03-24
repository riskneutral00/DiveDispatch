import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { requireAuth, getAuthUser } from './auth'
import { checkHasRole } from '../userRoles'

/**
 * Shared CRUD helpers for profile-style resource tables (instructors,
 * diveMasters, boats, equipment, compressors, diveCenters).
 *
 * Each table follows the same pattern: one profile row per userId,
 * looked up via a `by_userId` index. The helpers centralise that logic
 * so individual resource files only declare validators and thin wrappers.
 *
 * Type casts on `ctx.db.query(tableName as any)` etc. are necessary
 * because the table name is a runtime string — Convex's generated types
 * require a literal. The cast is safe because every caller passes a
 * valid table name constant.
 */

/** Handler for the `mine` query — returns the caller's own profile or null. */
export async function profileMine(ctx: QueryCtx, tableName: string) {
  const user = await getAuthUser(ctx)
  if (!user) return null

  return await ctx.db
    .query(tableName as any)
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique()
}

/** Handler for the `byUserId` query — returns a profile by userId. */
export async function profileByUserId(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tableName: string,
) {
  return await ctx.db
    .query(tableName as any)
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .unique()
}

/** Handler for the `update` mutation — patches the caller's own profile. */
export async function profileUpdate(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  tableName: string,
) {
  const { user } = await requireAuth(ctx)

  const profile = await ctx.db
    .query(tableName as any)
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique()
  if (!profile) throw new ConvexError({ code: 'NOT_FOUND' })

  await ctx.db.patch(profile._id, args)
}

/**
 * Handler for the `create` mutation — inserts a new profile if one does
 * not already exist for the caller. Returns the existing or new `_id`.
 *
 * @param roleName  Single role string or array when multiple roles are
 *                  accepted (e.g. Instructor + DiveMaster).
 * @param extraDefaults  Additional fields merged into the insert (e.g.
 *                       `{ verified: false, hasCompressor: false }`).
 */
export async function profileCreate(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  tableName: string,
  roleName: string | string[],
  extraDefaults?: Record<string, unknown>,
) {
  const { user } = await requireAuth(ctx)

  // Role check — any one of the listed roles is sufficient
  const roles = Array.isArray(roleName) ? roleName : [roleName]
  const hasAny = await Promise.all(
    roles.map((r) => checkHasRole(ctx, user._id, r)),
  )
  if (!hasAny.some(Boolean)) {
    throw new ConvexError({ code: 'FORBIDDEN' })
  }

  const existing = await ctx.db
    .query(tableName as any)
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique()
  if (existing) return existing._id

  return await ctx.db.insert(tableName as any, {
    ...args,
    userId: user._id,
    ...extraDefaults,
  })
}
