import { ConvexError } from 'convex/values'
import type { DbCtx } from './auth'
import type { Id } from '../_generated/dataModel'
import { tryGetActiveOrg } from './activeOrg'
import { batchGet } from './batch'
import { ErrorCode } from './errorCodes'

export async function visibleOrgIds(ctx: DbCtx): Promise<Id<'organizations'>[]> {
  const myOrg = await tryGetActiveOrg(ctx)
  if (!myOrg) return []
  const destinationIds = myOrg.destinationIds ?? []
  return [...destinationIds, myOrg._id]
}

export async function assertDestinationOrgsValid(
  ctx: DbCtx,
  ids: Id<'organizations'>[],
): Promise<void> {
  const orgs = await batchGet(ctx, ids)
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]
    if (!org) {
      throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'destination_org_not_found' })
    }
    if (org.isAreaOrg !== true) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'not_an_area_org' })
    }
  }
}
