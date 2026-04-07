import { internalMutation } from '../_generated/server'

export const backfillBlockedDates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allDocs = await ctx.db.query('stakeholderBlockedDates').collect()
    let updated = 0
    for (const doc of allDocs) {
      const raw = doc as Record<string, unknown>
      if (raw.ownerSlug && !doc.stakeholderId) {
        await ctx.db.patch(doc._id, { stakeholderId: raw.ownerSlug as string }) // batch-exempt
        updated++
      }
    }
    return { updated, total: allDocs.length }
  },
})
