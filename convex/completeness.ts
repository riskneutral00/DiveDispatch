import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import type { Id, TableNames } from './_generated/dataModel'
import { authorize, assertOrgOwnership } from './lib/auth'
import { getActiveOrg } from './lib/activeOrg'
import { ErrorCode } from './lib/errorCodes'
import { stakeholderTypeValidator } from './lib/validators'
import { ROLE_SPECS, isEntityRole } from './shared/roleKinds'
import { evaluateRowCompleteness } from './lib/completeness/perRow'

export const getEntityRowCompleteness = query({
  args: {
    role: stakeholderTypeValidator,
    entityId: v.string(),
  },
  handler: async (ctx, args): Promise<{ complete: boolean; incomplete: string[] }> => {
    if (!isEntityRole(args.role)) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `not_entity_role:${args.role}` })
    }
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const { org: activeOrg } = await getActiveOrg(ctx)

    const expectedTable = ROLE_SPECS[args.role].table as TableNames
    const row = await ctx.db.get(args.entityId as Id<TableNames>)
    if (!row) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    const idStr = (row as { _id: Id<TableNames> })._id.toString()
    if (!idStr.endsWith(expectedTable)) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'entityId_table_mismatch' })
    }
    const ownedRow = row as Record<string, unknown> & { organizationId?: Id<'organizations'> }
    assertOrgOwnership(ownedRow, activeOrg)

    return evaluateRowCompleteness(ctx, user, args.role, ownedRow, activeOrg._id)
  },
})
