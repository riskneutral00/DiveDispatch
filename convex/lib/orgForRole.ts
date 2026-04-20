import type { QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

export async function orgForRole(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: Doc<'userRoles'>['role'],
): Promise<Id<'organizations'> | null> {
  const userRole = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) => q.eq('userId', userId).eq('role', role))
    .unique()
  return userRole?.organizationId ?? null
}
