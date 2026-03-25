import { v } from 'convex/values'
import { query } from './_generated/server'

/**
 * Returns the most recent cronRunLog entry for a given job.
 * Used by the dashboard to display cron health status.
 */
export const lastCronRun = query({
  args: { jobName: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query('cronRunLog')
      .withIndex('by_jobName_runAt', (q) => q.eq('jobName', args.jobName))
      .order('desc')
      .first()

    return entry ?? null
  },
})
