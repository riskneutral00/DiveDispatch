import { v } from 'convex/values'
import { query } from './_generated/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

type ResourceOwnerType =
  | 'Boat'
  | 'Equipment'
  | 'Pool'
  | 'Compressor'
  | 'Instructor'
  | 'Liveaboard'
  | 'DiveSite'

export type InventoryListItem = {
  id: string
  name: string
  type: ResourceOwnerType
  ownerId: string
  ownerName: string
}

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/**
 * For each date in the input array, scans AvailabilitySnapshots for windows
 * with no remaining capacity. Returns the union of inventoryUnitIds that are
 * fully consumed across all queried dates.
 *
 * Privacy invariant: exposes only availableUnits count — never booking owner.
 */
export async function _getUnavailableUnitIdsForDates(
  ctx: AnyCtx,
  dates: string[],
): Promise<Set<string>> {
  const unavailable = new Set<string>()

  for (const date of dates) {
    const snapshots = await ctx.db
      .query('availabilitySnapshots')
      .filter((q: AnyCtx) => q.eq(q.field('date'), date))
      .collect()

    for (const snap of snapshots) {
      if (snap.availableUnits <= 0) {
        unavailable.add(snap.inventoryUnitId)
      }
    }
  }

  return unavailable
}

/**
 * Lists inventoryUnits by resourceType, optionally scoped to a single owner slug.
 * Joins with the users table to surface the owner's business name.
 *
 * Privacy invariant: does not expose booking or reservation data.
 */
export async function _listInventoryByType(
  ctx: AnyCtx,
  args: { type: ResourceOwnerType; ownerSlug?: string },
): Promise<InventoryListItem[]> {
  let units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_resourceType', (q: AnyCtx) => q.eq('resourceType', args.type))
    .collect()

  if (args.ownerSlug !== undefined) {
    units = units.filter((u: AnyCtx) => u.ownerId === args.ownerSlug)
  }

  const results: InventoryListItem[] = []

  for (const unit of units) {
    const owner = await ctx.db
      .query('users')
      .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', unit.ownerId))
      .first()

    results.push({
      id: unit._id,
      name: unit.displayName,
      type: unit.resourceType as ResourceOwnerType,
      ownerId: unit.ownerId,
      ownerName: owner?.businessName ?? unit.displayName,
    })
  }

  return results
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the array of inventoryUnitIds that have zero availability on any of
 * the given dates. UI converts to Set<string> for O(1) grey-out checks.
 */
export const getUnavailableUnitIdsForDates = query({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, args): Promise<string[]> => {
    const set = await _getUnavailableUnitIdsForDates(ctx, args.dates)
    return Array.from(set)
  },
})

/**
 * Lists inventoryUnits of a given resource type for the booking wizard's
 * resource picker. Optionally scoped to one owner.
 */
export const listInventoryByType = query({
  args: {
    type: v.union(
      v.literal('Boat'),
      v.literal('Equipment'),
      v.literal('Pool'),
      v.literal('Compressor'),
      v.literal('Instructor'),
      v.literal('Liveaboard'),
      v.literal('DiveSite'),
    ),
    ownerSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return _listInventoryByType(ctx, args)
  },
})
