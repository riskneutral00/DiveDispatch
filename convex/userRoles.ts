import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUser, requireAuth, OPERATOR_ROLE_SET } from './lib/auth'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id, Doc } from './_generated/dataModel'
import { stakeholderTypeValidator as stakeholderType, effectiveResourceType } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { deriveDefaultRole } from './lib/rolePrecedence'
import { batchGet, batchDelete } from './lib/batch'

// ─── Helpers (importable by other modules) ──────────────────────────────────

/**
 * Validate that a user holds the claimed active role.
 * Throws ROLE_NOT_HELD if the user does not have the role in userRoles.
 * Use this to validate the activeRole parameter on mutations.
 */
export async function requireActiveRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  activeRole: string,
): Promise<void> {
  const hasIt = await checkHasRole(ctx, userId, activeRole)
  if (!hasIt) throw new ConvexError({ code: ErrorCode.ROLE_NOT_HELD })
}

/** Check whether a user holds a specific role. */
export async function checkHasRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  role: string,
): Promise<boolean> {
  const entry = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) =>
      q.eq('userId', userId).eq('role', role as Doc<'userRoles'>['role']),
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
    if (roles.length === 0) return null
    const primaryRoleStr = deriveDefaultRole(roles.map((r) => r.role))
    return roles.find((r) => r.role === primaryRoleStr) ?? null
  },
})

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Add a role to the authenticated user. Rejects duplicates. */
export const addRole = mutation({
  args: {
    role: stakeholderType,
  },
  handler: async (ctx, { role }) => {
    const { user } = await requireAuth(ctx)

    const existing = await ctx.db
      .query('userRoles')
      .withIndex('by_userId_role', (q) =>
        q.eq('userId', user._id).eq('role', role),
      )
      .unique()
    if (existing) throw new ConvexError({ code: ErrorCode.DUPLICATE_ROLE })

    return ctx.db.insert('userRoles', {
      userId: user._id,
      role,
      createdAt: Date.now(),
      profileComplete: false,
    })
  },
})

/**
 * Count of Draft or Upcoming bookings that use this role's resources.
 * Used by the UI to determine whether a delete is blocked.
 */
export const bookingCountForRole = query({
  args: { roleId: v.id('userRoles') },
  handler: async (ctx, { roleId }) => {
    const roleRow = await ctx.db.get(roleId)
    if (!roleRow) return 0

    const user = await ctx.db.get(roleRow.userId)
    if (!user) return 0

    const resourceType = effectiveResourceType(roleRow.role)
    if (!resourceType) return 0

    // Find all bookingResources for this user slug + resource type
    const resources = await ctx.db
      .query('bookingResources')
      .withIndex('by_resourceType_resourceSlug', (q) =>
        q.eq('resourceType', resourceType).eq('resourceSlug', user.slug),
      )
      .collect()

    if (resources.length === 0) return 0

    // Batch-fetch all referenced bookings, then count active statuses
    const bookings = await batchGet(ctx, resources.map((r) => r.bookingId))
    return bookings.filter(
      (b) => b !== null && (b.status === 'Draft' || b.status === 'Upcoming'),
    ).length
  },
})

/**
 * Returns a map of roleId → active booking count for all of the caller's roles.
 * Single query — avoids calling bookingCountForRole in a React hook loop.
 */
export const bookingCountsForMyRoles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return {} satisfies Record<string, number>

    const roles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()

    const counts: Record<string, number> = {}
    for (const role of roles) {
      const resourceType = effectiveResourceType(role.role)
      if (!resourceType) {
        counts[role._id] = 0
        continue
      }
      counts[role._id] = await countActiveBookings(ctx, user.slug, resourceType) // batch-exempt: role count is bounded (max ~5)
    }
    return counts
  },
})

/** Helper: count active bookings for a user slug + resource type (shared by deleteRole). */
async function countActiveBookings(
  ctx: QueryCtx | MutationCtx,
  slug: string,
  resourceType: Doc<'inventoryUnits'>['resourceType'],
): Promise<number> {
  const resources = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceType_resourceSlug', (q) =>
      q.eq('resourceType', resourceType).eq('resourceSlug', slug),
    )
    .collect()

  if (resources.length === 0) return 0

  const bookings = await batchGet(ctx, resources.map((r) => r.bookingId))
  return bookings.filter(
    (b) => b !== null && (b.status === 'Draft' || b.status === 'Upcoming'),
  ).length
}

/**
 * Delete a role and cascade to profile, inventoryUnits, and availability snapshots.
 * Guards:
 *   - requireAuth: caller must own the role
 *   - LAST_ROLE: minimum 1 role must remain
 *   - booking guard: returns { blocked, bookingCount } if active bookings exist
 * Returns { deleted: true } on success or { blocked: true, bookingCount: N } if blocked.
 */
export const deleteRole = mutation({
  args: { roleId: v.id('userRoles') },
  handler: async (ctx, { roleId }) => {
    const { user } = await requireAuth(ctx)

    const roleRow = await ctx.db.get(roleId)
    if (!roleRow) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (roleRow.userId !== user._id) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    // Minimum-1 guard
    const allRoles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()
    if (allRoles.length <= 1) throw new ConvexError({ code: ErrorCode.LAST_ROLE })

    // Booking guard — check for Draft/Upcoming bookings using this role's resources
    const resourceType = effectiveResourceType(roleRow.role)
    if (resourceType) {
      const bookingCount = await countActiveBookings(ctx, user.slug, resourceType)
      if (bookingCount > 0) {
        return { blocked: true as const, bookingCount }
      }
    }

    // Hard-delete cascade

    // 1. Delete userRoles row
    await ctx.db.delete(roleId)

    // 2. Delete profile record (table varies by role)
    await deleteProfileForRole(ctx, roleRow.role, user._id)

    // 3. Delete inventoryUnits + their snapshots for this user slug + resource type
    if (resourceType) {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', user.slug).eq('ownerType', resourceType),
        )
        .collect()

      // Fetch all snapshots for all units in parallel
      const snapshotSets = await Promise.all(
        units.map((unit) =>
          ctx.db
            .query('availabilitySnapshots')
            .withIndex('by_inventoryUnitId_date', (q) =>
              q.eq('inventoryUnitId', unit._id),
            )
            .collect(),
        ),
      )
      const allSnapshots = snapshotSets.flat()

      await batchDelete(ctx, allSnapshots)
      await batchDelete(ctx, units)
    }

    return { deleted: true as const }
  },
})

// ─── Profile delete helper ───────────────────────────────────────────────────
// Each branch queries the correct typed table — no unsafe cast needed.

async function deleteProfileForRole(
  ctx: MutationCtx,
  role: Doc<'userRoles'>['role'],
  userId: Id<'users'>,
): Promise<void> {
  switch (role) {
    case 'DiveCenter': {
      const p = await ctx.db.query('diveCenters').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    case 'Instructor': {
      const p = await ctx.db.query('instructors').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    case 'Boat': {
      const p = await ctx.db.query('boats').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    case 'Equipment': {
      const p = await ctx.db.query('equipment').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    case 'Compressor': {
      const p = await ctx.db.query('compressors').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    case 'DiveSite':
    case 'Pool': {
      const p = await ctx.db.query('venues').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    case 'Agent': {
      const p = await ctx.db.query('agents').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    case 'DiveMaster': {
      const p = await ctx.db.query('diveMasters').withIndex('by_userId', (q) => q.eq('userId', userId)).unique()
      if (p) await ctx.db.delete(p._id)
      break
    }
    // Liveaboard, DiveResort, DiveHostel: no separate profile table yet
    default:
      break
  }
}
