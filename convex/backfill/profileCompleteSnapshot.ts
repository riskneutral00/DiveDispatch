import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { checkProfileCompleteness } from '../lib/profileCompleteness'

export const backfillProfileCompleteSnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const rows = await ctx.db.query('userRoles').collect() // bounded: dev-only one-off backfill
    const results: Array<{ userRoleId: string; role: string; profileComplete: boolean; changed: boolean }> = []

    for (const row of rows) {
      const { percentage } = await checkProfileCompleteness(ctx, { _id: row.userId }, row.role) // batch-exempt: dev-only sequential backfill
      const next = percentage === 100
      const changed = row.profileComplete !== next
      if (changed) {
        await ctx.db.patch(row._id, { profileComplete: next }) // batch-exempt: dev-only backfill
      }
      results.push({ userRoleId: row._id, role: row.role, profileComplete: next, changed })
    }

    return results
  },
})
