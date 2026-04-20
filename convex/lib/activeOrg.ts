import { ConvexError } from 'convex/values'
import type { UserIdentity } from 'convex/server'
import type { Doc } from '../_generated/dataModel'
import type { DbCtx } from './auth'
import { ErrorCode } from './errorCodes'

type OrgIdentityClaims = {
  orgId?: string
  orgRole?: string
  orgSlug?: string
}

function readOrgClaims(identity: UserIdentity): OrgIdentityClaims {
  const claims = identity as unknown as Record<string, unknown>
  return {
    orgId: typeof claims.orgId === 'string' ? claims.orgId : undefined,
    orgRole: typeof claims.orgRole === 'string' ? claims.orgRole : undefined,
    orgSlug: typeof claims.orgSlug === 'string' ? claims.orgSlug : undefined,
  }
}

export async function getActiveOrg(
  ctx: DbCtx,
): Promise<{ org: Doc<'organizations'>; orgRole: 'admin' | 'member' }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

  const { orgId: clerkOrgId, orgRole } = readOrgClaims(identity)
  if (!clerkOrgId) throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'no_active_org' })

  const org = await ctx.db
    .query('organizations')
    .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
  if (!org) throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'org_not_synced' })

  const normalizedRole = orgRole === 'admin' ? 'admin' : 'member'
  return { org, orgRole: normalizedRole }
}

export async function requireOrgAdmin(
  ctx: DbCtx,
): Promise<{ org: Doc<'organizations'> }> {
  const { org, orgRole } = await getActiveOrg(ctx)
  if (orgRole !== 'admin') {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'org_admin_required' })
  }
  return { org }
}

export async function tryGetActiveOrg(
  ctx: DbCtx,
): Promise<Doc<'organizations'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const { orgId: clerkOrgId } = readOrgClaims(identity)
  if (!clerkOrgId) return null
  return await ctx.db
    .query('organizations')
    .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
}
