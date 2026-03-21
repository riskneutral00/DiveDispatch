import { v } from 'convex/values'
import { query } from './_generated/server'
import type { AnyCtx } from './lib/auth'

// Managed resource types owned by organizers.
// Instructor and DiveMaster are always independent and are never included.
const MANAGED_CHILD_TYPES = new Set(['Boat', 'Equipment', 'Pool', 'Compressor'])

export async function _getManagedChildrenHandler(
  ctx: AnyCtx,
  args: { parentSlug: string },
): Promise<Array<{ childSlug: string; childType: string; childName: string }>> {
  const rows = await ctx.db
    .query('stakeholderHierarchy')
    .withIndex('by_parentSlug', (q: AnyCtx) => q.eq('parentSlug', args.parentSlug))
    .collect()

  const managed = rows.filter((r: AnyCtx) => MANAGED_CHILD_TYPES.has(r.childType))

  const results: Array<{ childSlug: string; childType: string; childName: string }> = []
  for (const r of managed) {
    const childUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', r.childSlug))
      .unique()
    results.push({
      childSlug: r.childSlug as string,
      childType: r.childType as string,
      childName: (childUser?.businessName as string) ?? (r.childSlug as string),
    })
  }

  return results
}

export const getManagedChildren = query({
  args: { parentSlug: v.string() },
  handler: _getManagedChildrenHandler,
})

export const getManagedParent = query({
  args: { childSlug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('stakeholderHierarchy')
      .withIndex('by_childSlug', (q: AnyCtx) => q.eq('childSlug', args.childSlug))
      .first()

    if (!row) return null

    const parentUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', row.parentSlug))
      .unique()

    return {
      parentSlug: row.parentSlug as string,
      parentType: row.parentType as string,
      parentName: (parentUser?.businessName as string) ?? (row.parentSlug as string),
    }
  },
})
