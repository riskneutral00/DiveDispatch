import { mutation } from '../_generated/server'
import { v } from 'convex/values'
import { requireDevEnvironment } from '../lib/devGuard'
import { getOrCreateTombstoneOrg } from '../lib/orgCascade'

export const run = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    total_users: v.number(),
    patched_users: v.number(),
    tombstone_slug: v.string(),
    user_slugs: v.array(v.string()),
  }),
  handler: async (ctx, { dryRun }) => {
    requireDevEnvironment()
    const all = await ctx.db.query('users').collect() // bounded: dev-only one-shot, total user count ≤100
    const orphans = all.filter((u) => u.organizationId === undefined)
    if (orphans.length === 0) {
      return { total_users: all.length, patched_users: 0, tombstone_slug: '__deleted__', user_slugs: [] }
    }
    const tombstoneId = dryRun ? null : await getOrCreateTombstoneOrg(ctx)
    if (!dryRun && tombstoneId) {
      for (const u of orphans) {
        await ctx.db.patch(u._id, { organizationId: tombstoneId }) // batch-exempt: dev-only one-shot, ≤100 rows
      }
    }
    return {
      total_users: all.length,
      patched_users: orphans.length,
      tombstone_slug: '__deleted__',
      user_slugs: orphans.map((u) => u.slug),
    }
  },
})
