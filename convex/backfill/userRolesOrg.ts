import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import type { Id, TableNames } from '../_generated/dataModel'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { ROLE_TABLE_MAP } from '../lib/profileHelpers'
import { queryDynamicTable } from '../lib/typedDb'

type BackfillAction =
  | 'already_set'
  | 'resolved_from_profile_at_user_org'
  | 'resolved_from_unclaimed_profile'
  | 'inherited_from_user_org'
  | 'created_personal_org'
  | 'no_user_org_skipped'

export const backfillUserRolesOrg = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const userRoles = await ctx.db.query('userRoles').collect() // bounded: dev-only one-off backfill, small dataset
    const now = Date.now()
    const results: Array<{ userRoleId: string; userId: string; role: string; action: BackfillAction; organizationId?: string }> = []

    const claimedOrgByRole = new Map<string, Set<Id<'organizations'>>>()
    for (const ur of userRoles) {
      if (!ur.organizationId) continue
      const set = claimedOrgByRole.get(ur.role) ?? new Set()
      set.add(ur.organizationId)
      claimedOrgByRole.set(ur.role, set)
    }

    for (const ur of userRoles) {
      if (ur.organizationId) {
        results.push({ userRoleId: ur._id, userId: ur.userId, role: ur.role, action: 'already_set', organizationId: ur.organizationId })
        continue
      }

      const table = ROLE_TABLE_MAP[ur.role] as TableNames | undefined
      const user = await ctx.db.get(ur.userId) // batch-exempt: dev-only backfill, per-userRole sequential reads

      let resolved: Id<'organizations'> | null = null
      let action: BackfillAction | null = null

      if (table && user?.organizationId) {
        const profileAtUserOrg = await queryDynamicTable(ctx.db, table) // batch-exempt: dev-only backfill
          .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
          .unique()
        if (profileAtUserOrg) {
          resolved = user.organizationId
          action = 'resolved_from_profile_at_user_org'
        }
      }

      if (!resolved && table) {
        // bounded: dev-only backfill, small dev dataset
        const allRows = await queryDynamicTable(ctx.db, table).collect()
        const claimed = claimedOrgByRole.get(ur.role) ?? new Set<Id<'organizations'>>()
        const candidates = allRows
          .map((r) => (r as { organizationId: Id<'organizations'> }).organizationId)
          .filter((oid) => !claimed.has(oid))
        if (candidates.length === 1) {
          resolved = candidates[0]
          action = 'resolved_from_unclaimed_profile'
        }
      }

      if (!resolved && user?.organizationId) {
        resolved = user.organizationId
        action = 'inherited_from_user_org'
      }

      if (!resolved && user) {
        const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email || user.slug
        const orgId = await ctx.db.insert('organizations', { // batch-exempt: dev-only backfill
          slug: user.slug,
          name: displayName,
          createdAt: now,
          updatedAt: now,
        })
        resolved = orgId
        action = 'created_personal_org'
      }

      if (!resolved) {
        results.push({ userRoleId: ur._id, userId: ur.userId, role: ur.role, action: 'no_user_org_skipped' })
        continue
      }

      await ctx.db.patch(ur._id, { organizationId: resolved }) // batch-exempt: dev-only backfill
      const set = claimedOrgByRole.get(ur.role) ?? new Set()
      set.add(resolved)
      claimedOrgByRole.set(ur.role, set)
      results.push({ userRoleId: ur._id, userId: ur.userId, role: ur.role, action: action!, organizationId: resolved })
    }

    return results
  },
})
