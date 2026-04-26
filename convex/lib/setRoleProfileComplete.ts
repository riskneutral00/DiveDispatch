import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Id, Doc, TableNames } from '../_generated/dataModel'
import { checkProfileCompleteness } from './profileCompleteness'
import { isPersonRole, isEntityRole, ROLE_SPECS as ROLE_KIND_SPECS } from '../shared/roleKinds'
import { evaluateRowCompleteness } from './completeness/perRow'
import { queryDynamicTable, patchDynamic } from './typedDb'

async function aggregateEntityProfileComplete(
  ctx: MutationCtx,
  userDoc: Doc<'users'>,
  role: string,
  table: TableNames,
): Promise<boolean> {
  if (!userDoc.organizationId) return false
  const rows = await queryDynamicTable(ctx.db, table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', userDoc.organizationId!))
    .collect() // bounded: per-org entity-role row count
  if (rows.length === 0) return false

  let allComplete = true
  for (const row of rows) {
    const { complete } = await evaluateRowCompleteness( // batch-exempt: per-row evaluator + patch must run sequentially to avoid race on the same row
      ctx,
      userDoc,
      role,
      row as Record<string, unknown>,
      userDoc.organizationId,
    )
    const r = row as Record<string, unknown> & { _id: Id<TableNames>; profileComplete?: boolean }
    if (r.profileComplete !== complete) {
      await patchDynamic(ctx.db, r._id, { profileComplete: complete }) // batch-exempt: per-row patch
    }
    if (!complete) allComplete = false
  }
  return allComplete
}

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

  let next: boolean
  if (isEntityRole(role)) {
    const userDoc = await ctx.db.get(userId)
    if (!userDoc) return
    const table = ROLE_KIND_SPECS[role].table
    next = await aggregateEntityProfileComplete(ctx, userDoc, role, table)
  } else if (isPersonRole(role)) {
    const { percentage } = await checkProfileCompleteness(ctx, { _id: userId }, role)
    next = percentage === 100
  } else {
    const { percentage } = await checkProfileCompleteness(ctx, { _id: userId }, role)
    next = percentage === 100
  }

  if (row.profileComplete !== next) {
    await ctx.db.patch(row._id, { profileComplete: next }) // snapshot: derived from per-row evaluator (entity) or checkProfileCompleteness (person), AND-aggregated
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
