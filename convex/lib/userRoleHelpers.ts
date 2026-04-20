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

type StakeholderType = Infer<typeof stakeholderTypeValidator>

export async function insertUserRole(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    role: StakeholderType
    organizationId?: Id<'organizations'>
    createdAt?: number
  },
): Promise<Id<'userRoles'>> {
  let organizationId = args.organizationId
  if (organizationId === undefined) {
    const user = await ctx.db.get(args.userId)
    organizationId = user?.organizationId
  }
  return await ctx.db.insert('userRoles', {
    userId: args.userId,
    role: args.role,
    createdAt: args.createdAt ?? Date.now(),
    ...(organizationId !== undefined && { organizationId }),
  })
}
