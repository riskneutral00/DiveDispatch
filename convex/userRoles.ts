import { ConvexError, v } from 'convex/values'
import { mutation, query, internalMutation } from './_generated/server'
import { BOOKING_STATUS } from './shared/statuses'
import { getAuthUser, OPERATOR_ROLE_SET, authorize } from './lib/auth'
import { getAllUserRoles, getUserRolesInOrg, insertUserRole, findMembership, type PermissionLevel } from './lib/userRoleHelpers'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id, Doc } from './_generated/dataModel'
import { stakeholderTypeValidator as stakeholderType, effectiveResourceType } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { deriveDefaultRole, ROLE_PRECEDENCE } from './lib/rolePrecedence'
import { batchGet, batchDelete, batchPatch } from './lib/batch'
import { ROLE_TABLE_MAP } from './lib/profileHelpers'
import { queryAllDynamicTable, deleteDynamic } from './lib/typedDb'
import { checkProfileCompleteness } from './lib/profileCompleteness'
import { cleanupInventoryForOwner } from './lib/inventoryCleanup'
import { checkIdempotency } from './lib/idempotency'
import { log } from './lib/logger'

export { getAllUserRoles } from './lib/userRoleHelpers'

type RoleReadiness = {
  percentage: number
  incomplete: string[]
}

export async function requireActiveRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  activeRole: string,
): Promise<void> {
  const hasIt = await checkHasRole(ctx, userId, activeRole)
  if (!hasIt) throw new ConvexError({ code: ErrorCode.ROLE_NOT_HELD })
}

export function assertRoleReadiness(status: RoleReadiness): void {
  if (status.percentage < 100) {
    throw new ConvexError({ code: ErrorCode.PROFILE_INCOMPLETE, missing: status.incomplete })
  }
}

export async function requireRoleReadiness(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  role: string,
): Promise<RoleReadiness> {
  const status = await checkProfileCompleteness(ctx, { _id: userId }, role)
  assertRoleReadiness(status)
  return status
}

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

export async function checkHasAnyOperatorRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<boolean> {
  const roles = await getAllUserRoles(ctx, userId)
  return roles.some((r) => OPERATOR_ROLE_SET.has(r.role))
}

function sortUserRolesByPrecedence<T extends { role: string; _id: Id<'userRoles'> }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const pa = ROLE_PRECEDENCE[a.role] ?? Infinity
    const pb = ROLE_PRECEDENCE[b.role] ?? Infinity
    if (pa !== pb) return pa - pb
    return a._id < b._id ? -1 : a._id > b._id ? 1 : 0
  })
}

export const myRoles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return []
    const rows = await getAllUserRoles(ctx, user._id)
    return sortUserRolesByPrecedence(rows)
  },
})

export const hasRole = query({
  args: { role: stakeholderType },
  handler: async (ctx, { role }) => {
    const user = await getAuthUser(ctx)
    if (!user) return false
    return checkHasRole(ctx, user._id, role)
  },
})

export const hasAnyOperatorRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return false
    return checkHasAnyOperatorRole(ctx, user._id)
  },
})

export const primaryRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return null
    const roles = await getAllUserRoles(ctx, user._id)
    if (roles.length === 0) return null
    const primaryRoleStr = deriveDefaultRole(roles.map((r) => r.role))
    return roles.find((r) => r.role === primaryRoleStr) ?? null
  },
})

export const addRole = mutation({
  args: {
    role: stakeholderType,
  },
  handler: async (ctx, { role }) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })

    const existing = await ctx.db
      .query('userRoles')
      .withIndex('by_userId_role', (q) =>
        q.eq('userId', user._id).eq('role', role),
      )
      .unique()
    if (existing) throw new ConvexError({ code: ErrorCode.DUPLICATE_ROLE })

    if (!user.organizationId) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'no_active_org' })
    }

    const membership = await findMembership(ctx, user._id, user.organizationId)
    const permissionLevel: PermissionLevel = membership?.permissionLevel ?? 'member'

    return insertUserRole(ctx, {
      userId: user._id,
      role,
      organizationId: user.organizationId,
      permissionLevel,
    })
  },
})

export const bookingCountForRole = query({
  args: { roleId: v.id('userRoles') },
  handler: async (ctx, { roleId }) => {
    const authUser = await getAuthUser(ctx)
    if (!authUser) return 0

    const roleRow = await ctx.db.get(roleId)
    if (!roleRow) return 0
    if (roleRow.userId !== authUser._id) return 0

    const user = await ctx.db.get(roleRow.userId)
    if (!user) return 0

    const resourceType = effectiveResourceType(roleRow.role)
    if (!resourceType) return 0

    const resources = await ctx.db
      .query('bookingResources')
      .withIndex('by_resourceType_resourceId', (q) =>
        q.eq('resourceType', resourceType).eq('resourceId', user.slug),
      )
      .collect() // bounded: per-user roles, max ~12

    if (resources.length === 0) return 0

    const bookings = await batchGet(ctx, resources.map((r) => r.bookingId))
    return bookings.filter(
      (b) => b !== null && (b.status === BOOKING_STATUS.Draft || b.status === BOOKING_STATUS.Upcoming),
    ).length
  },
})

export const bookingCountsForMyRoles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return {} satisfies Record<string, number>

    const roles = await getAllUserRoles(ctx, user._id)

    const entries = await Promise.all(
      roles.map(async (role): Promise<[string, number]> => {
        const resourceType = effectiveResourceType(role.role)
        if (!resourceType) return [role._id, 0]
        const count = await countActiveBookings(ctx, user.slug, resourceType)
        return [role._id, count]
      }),
    )
    return Object.fromEntries(entries) as Record<string, number>
  },
})

async function countActiveBookings(
  ctx: QueryCtx | MutationCtx,
  slug: string,
  resourceType: Doc<'inventoryUnits'>['resourceType'],
): Promise<number> {
  const resources = await ctx.db
    .query('bookingResources')
    .withIndex('by_resourceType_resourceId', (q) =>
      q.eq('resourceType', resourceType).eq('resourceId', slug),
    )
    .take(500)

  if (resources.length === 0) return 0

  const bookings = await batchGet(ctx, resources.map((r) => r.bookingId))
  return bookings.filter(
    (b) => b !== null && (b.status === BOOKING_STATUS.Draft || b.status === BOOKING_STATUS.Upcoming),
  ).length
}

export const deleteRole = mutation({
  args: { roleId: v.id('userRoles') },
  handler: async (ctx, { roleId }) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })

    const roleRow = await ctx.db.get(roleId)
    if (!roleRow) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (roleRow.userId !== user._id) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    const allRoles = await getAllUserRoles(ctx, user._id)
    if (allRoles.length <= 1) throw new ConvexError({ code: ErrorCode.LAST_ROLE })

    const resourceType = effectiveResourceType(roleRow.role)
    if (resourceType) {
      const bookingCount = await countActiveBookings(ctx, user.slug, resourceType)
      if (bookingCount > 0) {
        return { blocked: true as const, bookingCount }
      }
    }

    await ctx.db.delete(roleId)

    if (resourceType === 'Venue') {
      const venues = await ctx.db
        .query('venues')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', roleRow.organizationId))
        .collect() // bounded: per-org venue count, realistic cap ~20
      for (const venue of venues) {
        await cleanupInventoryForOwner(ctx, venue.slug, 'Venue')
      }
    } else if (resourceType) {
      await cleanupInventoryForOwner(ctx, user.slug, resourceType)
    }

    await deleteProfileForRole(ctx, roleRow.role, roleRow.organizationId)

    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', user.slug))
      .collect() // bounded: per-user roles, max ~12
    const rolePrefs = prefs.filter((p) => p.stakeholderType === roleRow.role)
    await batchDelete(ctx, rolePrefs)

    const blockedDates = await ctx.db
      .query('stakeholderBlockedDates')
      .withIndex('by_stakeholderId_roleType', (q) =>
        q.eq('stakeholderId', user.slug).eq('roleType', roleRow.role),
      )
      .collect() // bounded: per-user roles, max ~12
    await batchDelete(ctx, blockedDates)

    return { deleted: true as const }
  },
})

async function deleteProfileForRole(
  ctx: MutationCtx,
  role: Doc<'userRoles'>['role'],
  organizationId: Id<'organizations'>,
): Promise<void> {
  const tableName = ROLE_TABLE_MAP[role]
  if (!tableName) return

  const otherHolder = await ctx.db
    .query('userRoles')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', organizationId))
    .filter((q) => q.eq(q.field('role'), role))
    .first()
  if (otherHolder) return

  if (role === 'Venue') {
    const venues = await ctx.db
      .query('venues')
      .withIndex('by_organizationId', (q) => q.eq('organizationId', organizationId))
      .collect() // bounded: per-org venue count, realistic cap ~20
    for (const venue of venues) {
      await deleteDynamic(ctx.db, venue._id)
    }
    return
  }

  const p = await queryAllDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', organizationId))
    .unique()
  if (p) await deleteDynamic(ctx.db, p._id)
}

function clerkRoleToPermissionLevel(role: string | undefined): PermissionLevel {
  return role === 'org:admin' ? 'admin' : 'member'
}

async function findUserAndOrgForMembership(
  ctx: MutationCtx,
  tokenIdentifier: string,
  clerkOrgId: string,
): Promise<{ user: Doc<'users'>; org: Doc<'organizations'> } | null> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .unique()
  if (!user) return null
  const org = await ctx.db
    .query('organizations')
    .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
  if (!org) return null
  return { user, org }
}

export const upsertFromMembershipWebhook = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    clerkOrgId: v.string(),
    clerkRole: v.optional(v.string()),
    svixId: v.optional(v.string()),
  },
  returns: v.object({ patched: v.number(), unmatched: v.boolean() }),
  handler: async (ctx, args) => {
    if (args.svixId) {
      const isDuplicate = await checkIdempotency(ctx, args.svixId, 'clerk_membership_upsert')
      if (isDuplicate) return { patched: 0, unmatched: false }
    }

    const found = await findUserAndOrgForMembership(ctx, args.tokenIdentifier, args.clerkOrgId)
    if (!found) {
      log.warn('membership-webhook: no matching Convex user or org', {
        tokenIdentifier: args.tokenIdentifier,
        clerkOrgId: args.clerkOrgId,
      })
      return { patched: 0, unmatched: true }
    }

    const permissionLevel = clerkRoleToPermissionLevel(args.clerkRole)

    const rows = await getUserRolesInOrg(ctx, found.user._id, found.org._id)

    const updates = rows
      .filter((r) => r.permissionLevel !== permissionLevel)
      .map((r) => [r._id, { permissionLevel }] as const)
    await batchPatch(ctx, updates as never)

    return { patched: updates.length, unmatched: false }
  },
})

export const deleteFromMembershipWebhook = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    clerkOrgId: v.string(),
    svixId: v.optional(v.string()),
  },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    if (args.svixId) {
      const isDuplicate = await checkIdempotency(ctx, args.svixId, 'clerk_membership_delete')
      if (isDuplicate) return { deleted: 0 }
    }

    const found = await findUserAndOrgForMembership(ctx, args.tokenIdentifier, args.clerkOrgId)
    if (!found) return { deleted: 0 }

    const rows = await getUserRolesInOrg(ctx, found.user._id, found.org._id)

    await batchDelete(ctx, rows)

    for (const row of rows) {
      const resourceType = effectiveResourceType(row.role)
      if (resourceType === 'Venue') {
        const venues = await ctx.db
          .query('venues')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', row.organizationId))
          .collect() // bounded: per-org venue count, realistic cap ~20
        for (const venue of venues) {
          await cleanupInventoryForOwner(ctx, venue.slug, 'Venue')
        }
      } else if (resourceType) {
        await cleanupInventoryForOwner(ctx, found.user.slug, resourceType)
      }

      await deleteProfileForRole(ctx, row.role, row.organizationId)

      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', found.user.slug))
        .collect() // bounded: per-user roles, max ~12
      const rolePrefs = prefs.filter((p) => p.stakeholderType === row.role)
      await batchDelete(ctx, rolePrefs)

      const blockedDates = await ctx.db
        .query('stakeholderBlockedDates')
        .withIndex('by_stakeholderId_roleType', (q) =>
          q.eq('stakeholderId', found.user.slug).eq('roleType', row.role),
        )
        .collect() // bounded: per-user roles, max ~12
      await batchDelete(ctx, blockedDates)
    }

    return { deleted: rows.length }
  },
})
