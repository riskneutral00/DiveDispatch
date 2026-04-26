import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { batchPatch } from './batch'
import { getAllUserRoles } from './userRoleHelpers'

export async function setUserOrganization(
  ctx: MutationCtx,
  userId: Id<'users'>,
  organizationId: Id<'organizations'>,
): Promise<void> {
  await ctx.db.patch(userId, { organizationId })
  const roles = await getAllUserRoles(ctx, userId)
  const stale = roles.filter((r) => r.organizationId !== organizationId)
  if (stale.length === 0) return
  await batchPatch(
    ctx,
    stale.map((r) => [r._id, { organizationId }] as const),
  )
}
