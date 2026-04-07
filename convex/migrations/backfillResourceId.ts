import { internalMutation } from '../_generated/server'

export const backfillBookingResources = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allDocs = await ctx.db.query('bookingResources').collect()
    let updated = 0
    for (const doc of allDocs) {
      const raw = doc as Record<string, unknown>
      if (raw.resourceSlug !== undefined && raw.resourceId === undefined) {
        await ctx.db.patch(doc._id, { resourceId: raw.resourceSlug as string }) // batch-exempt
        updated++
      }
    }
    return { updated, total: allDocs.length }
  },
})
