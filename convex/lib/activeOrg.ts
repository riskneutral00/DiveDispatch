import { ConvexError } from 'convex/values'
import type { UserIdentity } from 'convex/server'
import type { Doc } from '../_generated/dataModel'
import type { DbCtx } from './auth'
import { ErrorCode } from './errorCodes'
import { log } from './logger'
import { findMembership, PERMISSION_LEVEL, type PermissionLevel } from './userRoleHelpers'

type OrgIdentityClaims = {
  orgId?: string
  orgRole?: string
  orgSlug?: string
}

export function readOrgClaims(identity: UserIdentity): OrgIdentityClaims {
  const claims = identity as unknown as Record<string, unknown>
  return {
    orgId: typeof claims.orgId === 'string' ? claims.orgId : undefined,
    orgRole: typeof claims.orgRole === 'string' ? claims.orgRole : undefined,
    orgSlug: typeof claims.orgSlug === 'string' ? claims.orgSlug : undefined,
  }
}

function membershipOrgRole(row: Doc<'userRoles'>): PermissionLevel {
  return row.permissionLevel ?? PERMISSION_LEVEL.Admin
}

async function resolveOrgFromMembership(
  ctx: DbCtx,
  identity: UserIdentity,
): Promise<{ org: Doc<'organizations'>; orgRole: PermissionLevel } | null> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique()
  if (!user?.organizationId) return null
  const membership = await findMembership(ctx, user._id, user.organizationId)
  if (!membership) return null
  const org = await ctx.db.get(user.organizationId)
  if (!org) return null
  if (org.deletedAt !== undefined) return null
  return { org, orgRole: membershipOrgRole(membership) }
}

async function resolveOrgFromJwtClaim(
  ctx: DbCtx,
  identity: UserIdentity,
  clerkOrgId: string,
  jwtOrgRole: string | undefined,
): Promise<{ org: Doc<'organizations'>; orgRole: PermissionLevel } | null> {
  const org = await ctx.db
    .query('organizations')
    .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
  if (!org) return null
  if (org.deletedAt !== undefined) return null
  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique()
  if (!user) return null
  const membership = await findMembership(ctx, user._id, org._id)
  if (!membership) return null
  const membershipRole = membershipOrgRole(membership)
  const claimRole: PermissionLevel = jwtOrgRole === PERMISSION_LEVEL.Admin ? PERMISSION_LEVEL.Admin : PERMISSION_LEVEL.Member
  const orgRole: PermissionLevel =
    membershipRole === PERMISSION_LEVEL.Admin && claimRole === PERMISSION_LEVEL.Admin ? PERMISSION_LEVEL.Admin : PERMISSION_LEVEL.Member
  return { org, orgRole }
}

export async function getActiveOrg(
  ctx: DbCtx,
): Promise<{ org: Doc<'organizations'>; orgRole: PermissionLevel }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

  const { orgId: clerkOrgId, orgRole } = readOrgClaims(identity)

  if (clerkOrgId) {
    const resolved = await resolveOrgFromJwtClaim(ctx, identity, clerkOrgId, orgRole)
    if (resolved) return resolved
  }

  const fallback = await resolveOrgFromMembership(ctx, identity)
  if (fallback) {
    if (clerkOrgId) {
      log.warn('active-org JWT claim did not resolve; granting access via membership fallback', {
        tokenIdentifier: identity.tokenIdentifier,
        jwtClerkOrgId: clerkOrgId,
        fallbackOrgId: fallback.org._id,
        fallbackClerkOrgId: fallback.org.clerkOrgId,
        fallbackOrgRole: fallback.orgRole,
      })
    }
    return fallback
  }

  throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'no_active_org' })
}

export async function requireOrgAdmin(
  ctx: DbCtx,
): Promise<{ org: Doc<'organizations'> }> {
  const { org, orgRole } = await getActiveOrg(ctx)
  if (orgRole !== PERMISSION_LEVEL.Admin) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'org_admin_required' })
  }
  return { org }
}

export async function tryGetActiveOrg(
  ctx: DbCtx,
): Promise<Doc<'organizations'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const { orgId: clerkOrgId, orgRole } = readOrgClaims(identity)

  if (clerkOrgId) {
    const resolved = await resolveOrgFromJwtClaim(ctx, identity, clerkOrgId, orgRole)
    if (resolved) return resolved.org
  }

  const fallback = await resolveOrgFromMembership(ctx, identity)
  return fallback ? fallback.org : null
}
