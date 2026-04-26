import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import type { TableNames, Doc } from '../_generated/dataModel'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { deriveDefaultEntitySlug } from '../lib/entitySlug'

const ENTITY_TABLES: ReadonlyArray<TableNames> = ['diveCenters', 'boats', 'equipment']

type EntityRow = Doc<'diveCenters'> | Doc<'boats'> | Doc<'equipment'>

export const backfillEntitySlugs = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const results: Array<{ table: string; rowId: string; action: 'set' | 'kept'; slug: string }> = []

    for (const table of ENTITY_TABLES) {
      // bounded: dev-only backfill, small entity-table row counts
      const rows = (await ctx.db.query(table).collect()) as EntityRow[]
      const seenSlugs = new Set<string>()

      for (const row of rows) {
        const existingSlug = (row as { slug?: unknown }).slug
        if (typeof existingSlug === 'string' && existingSlug.length > 0) {
          if (seenSlugs.has(existingSlug)) {
            throw new ConvexError({
              code: ErrorCode.VALIDATION,
              reason: `duplicate_slug:${table}:${existingSlug}`,
            })
          }
          seenSlugs.add(existingSlug)
          results.push({ table, rowId: row._id, action: 'kept', slug: existingSlug })
          continue
        }

        const owner = await ctx.db // batch-exempt: dev-only backfill, per-row owner lookup
          .query('users')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', row.organizationId))
          .first()
        const ownerSlug = owner?.slug ?? row._id
        let slug = deriveDefaultEntitySlug(table, ownerSlug)
        if (seenSlugs.has(slug)) {
          slug = `${slug}-${row._id.slice(-6)}`
        }
        seenSlugs.add(slug)
        await ctx.db.patch(row._id, { slug } as Partial<EntityRow>) // batch-exempt: dev-only backfill
        results.push({ table, rowId: row._id, action: 'set', slug })
      }
    }

    return results
  },
})
