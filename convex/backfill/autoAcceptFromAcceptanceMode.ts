import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'

export const backfillAutoAcceptFromAcceptanceMode = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const results: Array<{ rowId: string; action: 'set' | 'kept'; autoAccept: boolean | undefined }> = []

    const rows = await ctx.db.query('stakeholderPreferences').collect() // bounded: dev-only backfill, one row per (stakeholder, role)

    for (const row of rows) {
      if (typeof row.autoAccept === 'boolean') {
        results.push({ rowId: row._id, action: 'kept', autoAccept: row.autoAccept })
        continue
      }
      const autoAccept = row.acceptanceMode === undefined ? true : row.acceptanceMode === 'Auto'
      await ctx.db.patch(row._id, { autoAccept }) // batch-exempt: dev-only backfill
      results.push({ rowId: row._id, action: 'set', autoAccept })
    }

    return results
  },
})
