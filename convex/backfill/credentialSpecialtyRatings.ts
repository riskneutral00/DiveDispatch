import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { queryAllDynamicTable } from '../lib/typedDb'

type CredentialEntryIn = {
  agency: string
  level: string
  agencyID: string
  specialtyRatings?: string[]
}

type CredentialEntryNormalized = {
  agency: string
  level: string
  agencyID: string
  specialtyRatings: string[]
}

export const backfillCredentialSpecialtyRatings = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const rows = await queryAllDynamicTable(ctx.db, 'diveStaff').collect() // bounded: dev-only backfill, small diveStaff row counts

    let rowsTouched = 0
    let totalCredentialEntriesInspected = 0
    let entriesNormalized = 0

    for (const row of rows) {
      const credential = (row as { credential: CredentialEntryIn[] }).credential
      totalCredentialEntriesInspected += credential.length

      let needsPatch = false
      const normalized: CredentialEntryNormalized[] = credential.map((entry) => {
        if (!Array.isArray(entry.specialtyRatings)) {
          needsPatch = true
          entriesNormalized += 1
          return { agency: entry.agency, level: entry.level, agencyID: entry.agencyID, specialtyRatings: [] }
        }
        return { agency: entry.agency, level: entry.level, agencyID: entry.agencyID, specialtyRatings: entry.specialtyRatings }
      })

      if (needsPatch) {
        await ctx.db.patch(row._id as never, { credential: normalized } as never) // batch-exempt: dev-only backfill, per-row sequential
        rowsTouched += 1
      }
    }

    return { rowsTouched, totalCredentialEntriesInspected, entriesNormalized }
  },
})
