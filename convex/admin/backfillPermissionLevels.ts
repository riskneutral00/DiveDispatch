import { internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { requireDevEnvironment } from '../lib/devGuard'
import { batchPatch } from '../lib/batch'

export const run = internalMutation({
  args: {},
  returns: v.object({
    patched: v.number(),
    alreadySet: v.number(),
  }),
  handler: async (ctx) => {
    requireDevEnvironment()

    const rows = await ctx.db.query('userRoles').collect() // bounded: dev-only one-shot maintenance, total userRoles ≤low-thousands

    const updates = rows
      .filter((row) => row.permissionLevel === undefined)
      .map((row) => [row._id, { permissionLevel: 'admin' as const }] as const)

    await batchPatch(ctx, updates as never)

    return { patched: updates.length, alreadySet: rows.length - updates.length }
  },
})
