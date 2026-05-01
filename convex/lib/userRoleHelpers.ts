import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { Infer } from 'convex/values'
import type { stakeholderTypeValidator } from './validators'

export async function getAllUserRoles(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'userRoles'>[]> {
  return await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect() // bounded: per-user roles, max ~12
}

export async function findMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  organizationId: Id<'organizations'>,
): Promise<Doc<'userRoles'> | null> {
  return await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .filter((q) => q.eq(q.field('organizationId'), organizationId))
    .first()
}

export async function getUserRolesInOrg(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  organizationId: Id<'organizations'>,
): Promise<Doc<'userRoles'>[]> {
  return await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .filter((q) => q.eq(q.field('organizationId'), organizationId))
    .collect() // bounded: per-user-per-org roles, max ~12
}

type StakeholderType = Infer<typeof stakeholderTypeValidator>

export const PERMISSION_LEVEL = {
  Admin: 'admin',
  Member: 'member',
} as const

export type PermissionLevel = (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL]

export async function insertUserRole(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    role: StakeholderType
    organizationId: Id<'organizations'>
    permissionLevel?: PermissionLevel
    createdAt?: number
  },
): Promise<Id<'userRoles'>> {
  return await ctx.db.insert('userRoles', {
    userId: args.userId,
    role: args.role,
    organizationId: args.organizationId,
    permissionLevel: args.permissionLevel ?? PERMISSION_LEVEL.Admin,
    createdAt: args.createdAt ?? Date.now(),
  })
}
