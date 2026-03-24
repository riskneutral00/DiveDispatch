import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUser, requireAuth, OPERATOR_ROLE_SET } from './lib/auth'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'

// ─── Helpers (importable by other modules) ──────────────────────────────────

/** Check whether a user holds a specific role. */
export async function checkHasRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  role: string,
): Promise<boolean> {
  const entry = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) =>
      q.eq('userId', userId).eq('role', role as any),
    )
    .unique()
  return entry !== null
}

/** Check whether a user holds any operator role. */
export async function checkHasAnyOperatorRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<boolean> {
  const roles = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  return roles.some((r) => OPERATOR_ROLE_SET.has(r.role))
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** All roles for the authenticated user. */
export const myRoles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return []
    return ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()
  },
})

/** Does the authenticated user hold a specific role? */
export const hasRole = query({
  args: { role: stakeholderType },
  handler: async (ctx, { role }) => {
    const user = await getAuthUser(ctx)
    if (!user) return false
    return checkHasRole(ctx, user._id, role)
  },
})

/** Does the authenticated user hold any operator role? */
export const hasAnyOperatorRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return false
    return checkHasAnyOperatorRole(ctx, user._id)
  },
})

/** The primary role for the authenticated user (for default dashboard landing). */
export const primaryRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return null
    const roles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()
    return roles.find((r) => r.isPrimary) ?? null
  },
})

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Add a role to the authenticated user. Rejects duplicates. */
export const addRole = mutation({
  args: {
    role: stakeholderType,
    isPrimary: v.boolean(),
  },
  handler: async (ctx, { role, isPrimary }) => {
    const { user } = await requireAuth(ctx)

    const existing = await ctx.db
      .query('userRoles')
      .withIndex('by_userId_role', (q) =>
        q.eq('userId', user._id).eq('role', role),
      )
      .unique()
    if (existing) throw new ConvexError({ code: 'DUPLICATE_ROLE' })

    return ctx.db.insert('userRoles', {
      userId: user._id,
      role,
      isPrimary,
      createdAt: Date.now(),
      profileComplete: false,
    })
  },
})
