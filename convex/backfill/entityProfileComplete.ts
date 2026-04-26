import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import type { TableNames } from '../_generated/dataModel'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { evaluateRowCompleteness } from '../lib/completeness/perRow'
import { ROLE_SPECS } from '../shared/roleKinds'

const ENTITY_TABLE_TO_ROLE: Array<{ table: TableNames; role: keyof typeof ROLE_SPECS }> = [
  { table: 'diveCenters', role: 'DiveCenter' },
  { table: 'boats', role: 'Boat' },
  { table: 'equipment', role: 'Equipment' },
  { table: 'venues', role: 'Venue' },
  { table: 'compressors', role: 'Compressor' },
]

export const backfillEntityProfileComplete = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const results: Array<{ table: string; rowId: string; complete: boolean }> = []

    for (const { table, role } of ENTITY_TABLE_TO_ROLE) {
      // bounded: dev-only backfill, small entity-table row counts
      const rows = (await ctx.db.query(table).collect()) as Array<
        Record<string, unknown> & {
          _id: import('../_generated/dataModel').Id<typeof table>
          organizationId?: import('../_generated/dataModel').Id<'organizations'>
          profileComplete?: boolean
        }
      >
      for (const row of rows) {
        if (!row.organizationId) continue
        const owner = await ctx.db // batch-exempt: dev-only backfill, per-row sequential
          .query('users')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', row.organizationId!))
          .first()
        if (!owner) continue
        const { complete } = await evaluateRowCompleteness( // batch-exempt: dev-only backfill
          ctx,
          owner,
          role,
          row,
          row.organizationId,
        )
        if (row.profileComplete !== complete) {
          await ctx.db.patch(row._id, { profileComplete: complete }) // batch-exempt: dev-only backfill
        }
        results.push({ table, rowId: row._id, complete })
      }
    }

    return results
  },
})
