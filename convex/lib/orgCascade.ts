import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { batchDelete, batchPatch } from './batch'

const ROLE_TABLES = [
  'diveCenters',
  'diveStaff',
  'agents',
  'boats',
  'equipment',
  'compressors',
  'venues',
] as const

export type CascadeCounts = {
  usersUnbound: number
  userRolesDeleted: number
  profilesDeleted: number
  grandchildrenDeleted: number
}

export async function cascadeOrgDelete(
  ctx: MutationCtx,
  orgId: Id<'organizations'>,
): Promise<CascadeCounts> {
  const counts: CascadeCounts = {
    usersUnbound: 0,
    userRolesDeleted: 0,
    profilesDeleted: 0,
    grandchildrenDeleted: 0,
  }

  const users = await ctx.db
    .query('users')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
    .collect() // bounded: one org has O(members) users, practically <500
  await batchPatch(
    ctx,
    users.map((u) => [u._id, { organizationId: undefined }] as const),
  )
  counts.usersUnbound = users.length

  const userRoles = await ctx.db
    .query('userRoles')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
    .collect() // bounded: one org has O(members * roles) rows, practically <2000
  await batchDelete(ctx, userRoles)
  counts.userRolesDeleted = userRoles.length

  for (const tableName of ROLE_TABLES) {
    const rows = await ctx.db
      .query(tableName)
      .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
      .collect() // bounded: one org owns <20 rows per role table
    await batchDelete(ctx, rows)
    counts.profilesDeleted += rows.length
  }

  return counts
}
