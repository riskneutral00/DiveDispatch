import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { batchDelete, batchPatch } from './batch'
import { cleanupInventoryForOwner } from './inventoryCleanup'

export const SOFT_DELETE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const TOMBSTONE_ORG_SLUG = '__deleted__'

export async function getOrCreateTombstoneOrg(ctx: MutationCtx): Promise<Id<'organizations'>> {
  const existing = await ctx.db
    .query('organizations')
    .withIndex('by_slug', (q) => q.eq('slug', TOMBSTONE_ORG_SLUG))
    .unique()
  if (existing) return existing._id
  const now = Date.now()
  return await ctx.db.insert('organizations', {
    slug: TOMBSTONE_ORG_SLUG,
    name: 'Deleted',
    createdAt: now,
    updatedAt: now,
  })
}

export const ORG_CHILD_TABLES = [
  'diveCenters',
  'diveStaff',
  'agents',
  'boats',
  'equipment',
  'compressors',
  'venues',
] as const

export type OrgChildTable = (typeof ORG_CHILD_TABLES)[number]

type InventoryOwnerType = Doc<'inventoryUnits'>['ownerType']

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
  if (users.length > 0) {
    const tombstoneId = await getOrCreateTombstoneOrg(ctx)
    await batchPatch(
      ctx,
      users.map((u) => [u._id, { organizationId: tombstoneId }] as const),
    )
  }
  counts.usersUnbound = users.length

  const userRoles = await ctx.db
    .query('userRoles')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
    .collect() // bounded: one org has O(members * roles) rows, practically <2000
  await batchDelete(ctx, userRoles)
  counts.userRolesDeleted = userRoles.length

  const venueSlugs: string[] = []

  for (const tableName of ORG_CHILD_TABLES) {
    const rows = await ctx.db
      .query(tableName)
      .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
      .collect() // bounded: one org owns <20 rows per role table
    if (tableName === 'venues') {
      for (const r of rows) venueSlugs.push((r as Doc<'venues'>).slug)
    }
    await batchDelete(ctx, rows)
    counts.profilesDeleted += rows.length
  }

  for (const venueSlug of venueSlugs) {
    await cleanupInventoryForOwner(ctx, venueSlug, 'Venue')
  }

  const userBackedOwnerTypes: InventoryOwnerType[] = ['Boat', 'Equipment', 'Compressor']
  for (const user of users) {
    for (const ownerType of userBackedOwnerTypes) {
      await cleanupInventoryForOwner(ctx, user.slug, ownerType)
    }
  }

  return counts
}
