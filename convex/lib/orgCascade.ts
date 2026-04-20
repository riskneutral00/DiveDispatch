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
  'liveaboards',
  'diveResorts',
  'diveHostels',
] as const

export type CascadeCounts = {
  usersUnbound: number
  userRolesUnbound: number
  profilesDeleted: number
  grandchildrenDeleted: number
}

export async function cascadeOrgDelete(
  ctx: MutationCtx,
  orgId: Id<'organizations'>,
): Promise<CascadeCounts> {
  const counts: CascadeCounts = {
    usersUnbound: 0,
    userRolesUnbound: 0,
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
  await batchPatch(
    ctx,
    userRoles.map((r) => [r._id, { organizationId: undefined }] as const),
  )
  counts.userRolesUnbound = userRoles.length

  const liveaboardIds: Id<'liveaboards'>[] = []
  const diveResortIds: Id<'diveResorts'>[] = []

  for (const tableName of ROLE_TABLES) {
    const rows = await ctx.db
      .query(tableName)
      .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
      .collect() // bounded: one org owns <20 rows per role table
    if (tableName === 'liveaboards') {
      for (const r of rows) liveaboardIds.push(r._id as Id<'liveaboards'>)
    }
    if (tableName === 'diveResorts') {
      for (const r of rows) diveResortIds.push(r._id as Id<'diveResorts'>)
    }
    await batchDelete(ctx, rows)
    counts.profilesDeleted += rows.length
  }

  for (const liveaboardId of liveaboardIds) {
    const cabins = await ctx.db
      .query('cabins')
      .withIndex('by_liveaboardId', (q) => q.eq('liveaboardId', liveaboardId))
      .collect() // bounded: <50 cabins per liveaboard
    await batchDelete(ctx, cabins)
    counts.grandchildrenDeleted += cabins.length

    const trips = await ctx.db
      .query('tripSchedules')
      .withIndex('by_liveaboardId', (q) => q.eq('liveaboardId', liveaboardId))
      .collect() // bounded: <200 trips per liveaboard
    await batchDelete(ctx, trips)
    counts.grandchildrenDeleted += trips.length
  }

  for (const diveResortId of diveResortIds) {
    const rooms = await ctx.db
      .query('rooms')
      .withIndex('by_diveResortId', (q) => q.eq('diveResortId', diveResortId))
      .collect() // bounded: <100 rooms per resort
    await batchDelete(ctx, rooms)
    counts.grandchildrenDeleted += rooms.length
  }

  return counts
}
