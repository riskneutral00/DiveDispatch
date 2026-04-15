import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUser, OPERATOR_ROLE_SET, authorize } from './lib/auth'
import { getAllUserRoles } from './lib/userRoleHelpers'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id, Doc } from './_generated/dataModel'
import { stakeholderTypeValidator as stakeholderType, effectiveResourceType } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { deriveDefaultRole } from './lib/rolePrecedence'
import { batchGet, batchDelete } from './lib/batch'
import { ROLE_TABLE_MAP } from './lib/profileHelpers'
import { queryDynamicTable, deleteDynamic } from './lib/typedDb'
import { checkProfileCompleteness } from './lib/profileCompleteness'

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

function sortUserRolesByGrantOrder<T extends { createdAt: number; role: string; _id: Id<'userRoles'> }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const d = a.createdAt - b.createdAt
    if (d !== 0) return d
    return a._id < b._id ? -1 : a._id > b._id ? 1 : 0
  })
}

export const myRoles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return []
    const rows = await getAllUserRoles(ctx, user._id)
    return sortUserRolesByGrantOrder(rows)
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

    return ctx.db.insert('userRoles', {
      userId: user._id,
      role,
      createdAt: Date.now(),
      profileComplete: false,
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
      (b) => b !== null && (b.status === 'Draft' || b.status === 'Upcoming'),
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
    (b) => b !== null && (b.status === 'Draft' || b.status === 'Upcoming'),
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

    await deleteProfileForRole(ctx, roleRow.role, user._id)

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

    if (resourceType) {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', user.slug).eq('ownerType', resourceType),
        )
        .collect() // bounded: per-user roles, max ~12

      const [reservationSets, snapshotSets] = await Promise.all([
        Promise.all(
          units.map((unit) =>
            ctx.db
              .query('reservations')
              .withIndex('by_inventoryUnitId_status', (q) =>
                q.eq('inventoryUnitId', unit._id),
              )
              .collect(), // bounded: per-user roles, max ~12
          ),
        ),
        Promise.all(
          units.map((unit) =>
            ctx.db
              .query('availabilitySnapshots')
              .withIndex('by_inventoryUnitId_date', (q) =>
                q.eq('inventoryUnitId', unit._id),
              )
              .collect(), // bounded: per-user roles, max ~12
          ),
        ),
      ])
      const allReservations = reservationSets.flat()
      const allSnapshots = snapshotSets.flat()

      await batchDelete(ctx, allReservations)
      await batchDelete(ctx, allSnapshots)
      await batchDelete(ctx, units)
    }

    return { deleted: true as const }
  },
})

async function deleteProfileForRole(
  ctx: MutationCtx,
  role: Doc<'userRoles'>['role'],
  userId: Id<'users'>,
): Promise<void> {
  const tableName = ROLE_TABLE_MAP[role]
  if (!tableName) return
  const p = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  if (p) await deleteDynamic(ctx.db, p._id)
}
