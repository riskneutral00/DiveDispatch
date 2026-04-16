import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { UserIdentity } from 'convex/server'
import { ErrorCode } from './errorCodes'
import { OPERATOR_TYPES } from '../shared/operatorTypes'
import { getAllUserRoles } from './userRoleHelpers'
import { requireActiveRole, requireRoleReadiness } from '../userRoles'

export function assertOwnership(
  resource: { ownerId: string },
  user: { slug: string },
  errorMessage?: string,
): void {
  if (resource.ownerId !== user.slug) {
    throw new ConvexError(
      errorMessage
        ? { code: ErrorCode.FORBIDDEN, reason: errorMessage }
        : { code: ErrorCode.FORBIDDEN },
    )
  }
}

export type DbCtx = QueryCtx | MutationCtx

export const OPERATOR_ROLE_SET: ReadonlySet<string> = new Set(OPERATOR_TYPES)

export const HOLD_TTL_MS = 43200000

export async function requireAuth(ctx: DbCtx): Promise<{ identity: UserIdentity; user: Doc<'users'> }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
  if (!user) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  return { identity, user }
}

export async function getAuthUser(ctx: DbCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
}

export function assertCallerIsUser(
  caller: { slug: string },
  subjectUserId: string,
  reason?: string,
): void {
  if (subjectUserId !== caller.slug) {
    throw new ConvexError(
      reason
        ? { code: ErrorCode.FORBIDDEN, reason }
        : { code: ErrorCode.FORBIDDEN },
    )
  }
}

export async function requireOwnerOrResourceAccess(
  ctx: QueryCtx,
  user: { slug: string },
  bookingId: string | Id<'bookings'>,
): Promise<void> {
  const booking = await ctx.db.get(bookingId as Id<'bookings'>)
  if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  if (booking.ownerId === user.slug) return

  const callerUnits = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q) => q.eq('ownerId', user.slug))
    .take(200)
  const callerUnitIds = new Set(callerUnits.map((u) => u._id))
  const bookingReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .take(100)
  const hasReservation = bookingReservations.some((r) => callerUnitIds.has(r.inventoryUnitId))
  if (!hasReservation) throw new ConvexError({ code: ErrorCode.FORBIDDEN })
}

export type Action =
  | 'booking:create' | 'booking:read' | 'booking:manage' | 'booking:delete'
  | 'resource:read' | 'resource:manage'
  | 'theme:read' | 'theme:manage'
  | 'member:manage' | 'settings:manage'
  | 'reservation:accept' | 'reservation:decline'
  | 'notification:read' | 'notification:manage'
  | 'profile:read' | 'profile:manage'

export type AuthResource = {
  type: 'booking' | 'theme' | 'profile' | 'resource' | 'notification' | 'settings'
  id?: string
  ownerId?: string
  requiredRole?: string
}

const ACTION_TO_PERMISSION: Record<Action, string> = {
  'booking:create': 'org:bookings:create',
  'booking:read': 'org:bookings:read',
  'booking:manage': 'org:bookings:manage',
  'booking:delete': 'org:bookings:manage',
  'resource:read': 'org:resources:read',
  'resource:manage': 'org:resources:manage',
  'theme:read': 'org:themes:read',
  'theme:manage': 'org:themes:manage',
  'member:manage': 'org:members:manage',
  'settings:manage': 'org:settings:manage',
  'reservation:accept': 'org:bookings:manage',
  'reservation:decline': 'org:bookings:manage',
  'notification:read': 'org:bookings:read',
  'notification:manage': 'org:bookings:read',
  'profile:read': 'org:resources:read',
  'profile:manage': 'org:resources:manage',
}

const OPERATOR_ACTIONS = new Set<Action>(['booking:create', 'theme:manage'])

function extractOrgPermissions(identity: UserIdentity): string[] | null {
  const claims = identity as Record<string, unknown>
  const perms = claims.org_permissions
  if (!perms) return null
  if (Array.isArray(perms)) return perms as string[]
  if (typeof perms === 'string') {
    try { return JSON.parse(perms) as string[] } catch { return null }
  }
  return null
}

async function hasAnyOperatorRole(ctx: MutationCtx, userId: Id<'users'>): Promise<boolean> {
  const roles = await getAllUserRoles(ctx, userId)
  return roles.some((r) => OPERATOR_ROLE_SET.has(r.role))
}

export async function getRequiredUserBySlug(ctx: DbCtx, slug: string): Promise<Doc<'users'>> {
  const user = await getUserBySlug(ctx, slug)
  if (!user) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  return user
}

export async function getUserBySlug(ctx: DbCtx, slug: string): Promise<Doc<'users'> | null> {
  return ctx.db
    .query('users')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()
}

async function hasRole(
  ctx: MutationCtx,
  userId: Id<'users'>,
  role: string,
): Promise<boolean> {
  const entry = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) =>
      q.eq('userId', userId).eq('role', role as Doc<'userRoles'>['role']),
    )
    .unique()
  return entry !== null
}

export async function authorize(
  ctx: MutationCtx,
  actor: { user: Doc<'users'>; identity: UserIdentity } | null,
  action: Action,
  resource: AuthResource,
  _orgId?: string,
): Promise<{ user: Doc<'users'>; identity: UserIdentity }> {
  const resolved = actor ?? await requireAuth(ctx)
  const { user, identity } = resolved

  if (resource.ownerId && resource.ownerId === user.slug) {
    return resolved
  }

  const orgPermissions = extractOrgPermissions(identity)
  if (orgPermissions) {
    const required = ACTION_TO_PERMISSION[action]
    if (required && orgPermissions.includes(required)) {
      return resolved
    }
  }

  if (!orgPermissions) {
    if (OPERATOR_ACTIONS.has(action)) {
      const isOperator = await hasAnyOperatorRole(ctx, user._id)
      if (isOperator) return resolved
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    if (resource.requiredRole) {
      const hasIt = await hasRole(ctx, user._id, resource.requiredRole)
      if (hasIt) return resolved
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    if (resource.type === 'booking' && resource.id) {
      await requireOwnerOrResourceAccess(ctx, user, resource.id)
      return resolved
    }

    if (resource.ownerId) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    return resolved
  }

  throw new ConvexError({ code: ErrorCode.FORBIDDEN })
}

export async function authorizeWithRole(
  ctx: MutationCtx,
  action: Action,
  activeRole: string,
  resource: AuthResource,
  opts?: { requireReadiness?: boolean },
): Promise<{ user: Doc<'users'>; identity: UserIdentity }> {
  const resolved = await authorize(ctx, null, action, resource)
  await requireActiveRole(ctx, resolved.user._id, activeRole)
  if (opts?.requireReadiness) {
    await requireRoleReadiness(ctx, resolved.user._id, activeRole)
  }
  return resolved
}
