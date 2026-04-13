import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { batchPatch } from '../lib/batch'
import type { Id } from '../_generated/dataModel'

export const backfillReferrerLineage = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 1000
    const page = await ctx.db
      .query('bookings')
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize })

    const updates: Array<[Id<'bookings'>, { referrerId: string; referrerType: 'Agent' }]> = []
    let skippedNoAgentId = 0
    for (const booking of page.page) {
      const raw = booking as Record<string, unknown>
      const wasReferral = raw.agentIsReferral === true
      if (!wasReferral) continue
      if (booking.referrerId) continue
      const legacyAgentId = raw.agentId
      if (typeof legacyAgentId !== 'string' || legacyAgentId.length === 0) {
        skippedNoAgentId++
        continue
      }
      updates.push([booking._id, { referrerId: legacyAgentId, referrerType: 'Agent' }])
    }
    await batchPatch(ctx, updates)
    return {
      promoted: updates.length,
      skippedNoAgentId,
      scanned: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})
