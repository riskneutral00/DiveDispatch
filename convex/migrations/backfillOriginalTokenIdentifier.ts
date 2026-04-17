import { internalMutation } from '../_generated/server'
import { batchPatch } from '../lib/batch'
import type { Id } from '../_generated/dataModel'

export const backfillOriginalTokenIdentifier = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('users').collect() // bounded: one-time migration
    const updates: Array<[Id<'users'>, { originalTokenIdentifier: string }]> = []
    for (const u of all) {
      if (!u.originalTokenIdentifier) {
        updates.push([u._id, { originalTokenIdentifier: u.tokenIdentifier }])
      }
    }
    await batchPatch(ctx, updates)
    return { total: all.length, backfilled: updates.length }
  },
})
