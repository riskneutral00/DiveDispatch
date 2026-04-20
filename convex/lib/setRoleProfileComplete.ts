import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Id, Doc } from '../_generated/dataModel'
import { checkProfileCompleteness } from './profileCompleteness'

export async function setRoleProfileComplete(
  ctx: MutationCtx,
  userId: Id<'users'>,
  role: string,
): Promise<void> {
  const row = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) =>
      q.eq('userId', userId).eq('role', role as Doc<'userRoles'>['role']),
    )
    .unique()
  if (!row) return

  const { percentage } = await checkProfileCompleteness(ctx, { _id: userId }, role)
  const next = percentage === 100

  if (row.profileComplete !== next) {
    await ctx.db.patch(row._id, { profileComplete: next }) // snapshot: derived from checkProfileCompleteness, re-computed on every role-profile mutation
  }
}

export async function isRoleProfileComplete(
  ctx: QueryCtx | MutationCtx,
  userSlug: string,
  role: string,
): Promise<boolean> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_slug', (q) => q.eq('slug', userSlug))
    .unique()
  if (!user) return false

  const row = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) =>
      q.eq('userId', user._id).eq('role', role as Doc<'userRoles'>['role']),
    )
    .unique()
  return row?.profileComplete === true
}

export async function isUserRoleComplete(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  role: string,
): Promise<boolean> {
  const row = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) =>
      q.eq('userId', userId).eq('role', role as Doc<'userRoles'>['role']),
    )
    .unique()
  return row?.profileComplete === true
}
