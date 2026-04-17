import { internalMutation } from '../_generated/server'
import { batchGet, batchPatch } from '../lib/batch'
import type { Id } from '../_generated/dataModel'

export const backfillDiveStaffName = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('diveStaff').collect() // bounded: one-time migration
    const users = await batchGet(ctx, all.map((s) => s.userId))
    const updates: Array<[Id<'diveStaff'>, { name: string }]> = []
    let skipped = 0

    for (let i = 0; i < all.length; i++) {
      const staff = all[i]
      const user = users[i]
      if (!user) {
        skipped++
        continue
      }
      const derived = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
      if (!derived || derived === staff.name) {
        skipped++
        continue
      }
      updates.push([staff._id, { name: derived }])
    }

    await batchPatch(ctx, updates)
    return { total: all.length, patched: updates.length, skipped }
  },
})
