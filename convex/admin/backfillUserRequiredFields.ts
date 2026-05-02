import { mutation } from '../_generated/server'
import { v } from 'convex/values'
import { requireDevEnvironment } from '../lib/devGuard'

export const run = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    total: v.number(),
    patched: v.number(),
    slugs: v.array(v.string()),
  }),
  handler: async (ctx, { dryRun }) => {
    requireDevEnvironment()
    const all = await ctx.db.query('users').collect() // bounded: dev-only one-shot backfill, total user count ≤ 100
    const now = Date.now()
    const slugs: string[] = []
    let patched = 0
    for (const u of all) {
      const patch: Record<string, unknown> = {}
      const isAnonymized = u.email === 'deleted@deleted.invalid'
      if (u.phone === undefined) patch.phone = isAnonymized ? 'deleted' : ''
      if (u.dateOfBirth === undefined) patch.dateOfBirth = isAnonymized ? '1970-01-01' : ''
      if (u.tcAcceptedAt === undefined) patch.tcAcceptedAt = isAnonymized ? 0 : now
      if (u.tcVersion === undefined) patch.tcVersion = isAnonymized ? 'deleted' : '1.0'
      if (Object.keys(patch).length > 0) {
        if (!dryRun) await ctx.db.patch(u._id, patch) // batch-exempt: dev-only one-shot backfill, ≤100 rows
        patched += 1
        slugs.push(u.slug)
      }
    }
    return { total: all.length, patched, slugs }
  },
})
