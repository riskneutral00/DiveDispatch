import { v } from 'convex/values'
import { query } from './_generated/server'
import type { AnyCtx } from './lib/auth'

// Managed resource types owned by organizers.
// Instructor and DiveMaster are always independent and are never included.
const MANAGED_CHILD_TYPES = new Set(['Boat', 'Equipment', 'Pool', 'Compressor'])

export async function _getManagedChildrenHandler(
  ctx: AnyCtx,
  args: { parentSlug: string },
): Promise<Array<{ childSlug: string; childType: string }>> {
  const rows = await ctx.db
    .query('stakeholderHierarchy')
    .withIndex('by_parentSlug', (q: AnyCtx) => q.eq('parentSlug', args.parentSlug))
    .collect()

  return rows
    .filter((r: AnyCtx) => MANAGED_CHILD_TYPES.has(r.childType))
    .map((r: AnyCtx) => ({ childSlug: r.childSlug as string, childType: r.childType as string }))
}

export const getManagedChildren = query({
  args: { parentSlug: v.string() },
  handler: _getManagedChildrenHandler,
})
