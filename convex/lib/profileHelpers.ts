import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc, Id, TableNames } from '../_generated/dataModel'
import { requireAuth, getAuthUser } from './auth'
import { checkHasRole } from '../userRoles'
import { ErrorCode } from './errorCodes'
import { queryDynamicTable, insertDynamicTable, patchDynamic } from './typedDb'

/**
 * Maps stakeholder role strings to their Convex profile table names.
 * Used to eliminate switch/if-else chains when resolving role → table.
 */
export const ROLE_TABLE_MAP: Record<string, TableNames> = {
  Instructor: 'instructors',
  Boat: 'boats',
  Equipment: 'equipment',
  Pool: 'venues',
  DiveSite: 'venues',
  Compressor: 'compressors',
  DiveCenter: 'diveCenters',
  DiveMaster: 'diveMasters',
  Agent: 'agents',
  Liveaboard: 'liveaboards',
  DiveResort: 'diveResorts',
  DiveHostel: 'diveHostels',
}

/**
 * Shared CRUD helpers for profile-style resource tables (instructors,
 * diveMasters, boats, equipment, compressors, diveCenters).
 *
 * Each table follows the same pattern: one profile row per userId,
 * looked up via a `by_userId` index. The helpers centralise that logic
 * so individual resource files only declare validators and thin wrappers.
 */

/** Handler for the `mine` query — returns the caller's own profile or null. */
export async function profileMine<T extends TableNames>(
  ctx: QueryCtx,
  tableName: T,
): Promise<Doc<T> | null> {
  const user = await getAuthUser(ctx)
  if (!user) return null

  const doc = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique()
  return doc as Doc<T> | null
}

/** Handler for the `byUserId` query — returns a profile by userId. */
export async function profileByUserId<T extends TableNames>(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tableName: T,
): Promise<Doc<T> | null> {
  const doc = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  return doc as Doc<T> | null
}

/** Resolve a user slug to their profile in a given table. Returns null if user or profile not found. */
export async function profileBySlug(
  ctx: QueryCtx,
  slug: string,
  tableName: TableNames,
) {
  const user = await ctx.db.query('users').withIndex('by_slug', (q) => q.eq('slug', slug)).unique()
  if (!user) return null
  return profileByUserId(ctx, user._id, tableName)
}

/** Handler for the `update` mutation — patches the caller's own profile. */
export async function profileUpdate(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  tableName: TableNames,
) {
  const { user } = await requireAuth(ctx)

  const profile = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique()
  if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  await patchDynamic(ctx.db, profile._id, args)
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
  tableName: TableNames,
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
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }

  const existing = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique()
  if (existing) return existing._id

  // Auto-populate email/phone from user record if not provided or empty
  const mergedArgs = { ...args }
  if (!mergedArgs.email || (typeof mergedArgs.email === 'string' && mergedArgs.email.trim() === '')) {
    mergedArgs.email = user.email ?? ''
  }
  if (!mergedArgs.phone || (typeof mergedArgs.phone === 'string' && mergedArgs.phone.trim() === '')) {
    mergedArgs.phone = user.phone ?? ''
  }

  return await insertDynamicTable(ctx.db, tableName, {
    ...mergedArgs,
    userId: user._id,
    ...extraDefaults,
  })
}
