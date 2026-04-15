import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc, Id, TableNames } from '../_generated/dataModel'
import { authorize, getAuthUser } from './auth'
import { checkHasRole } from '../userRoles'
import { ErrorCode } from './errorCodes'
import { ROLE_REQUIRED } from './requiredFields'
import { queryDynamicTable, insertDynamicTable, patchDynamic } from './typedDb'

export const ROLE_TABLE_MAP: Record<string, TableNames> = {
  Instructor: 'instructors',
  Boat: 'boats',
  Equipment: 'equipment',
  Pool: 'venues',
  DiveSite: 'venues',
  Compressor: 'compressors',
  DiveCenter: 'diveCenters',
  DiveMaster: 'diveMasters',
  Agent: 'agents',
  Liveaboard: 'liveaboards',
  DiveResort: 'diveResorts',
  DiveHostel: 'diveHostels',
}

export async function profileMine<T extends TableNames>(
  ctx: QueryCtx,
  tableName: T,
): Promise<Doc<T> | null> {
  const user = await getAuthUser(ctx)
  if (!user) return null

  const doc = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique()
  return doc as Doc<T> | null
}

export async function profileByUserId<T extends TableNames>(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tableName: T,
): Promise<Doc<T> | null> {
  const doc = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  return doc as Doc<T> | null
}

export async function requireProfile<T extends TableNames>(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tableName: T,
): Promise<Doc<T>> {
  const profile = await profileByUserId(ctx, userId, tableName)
  if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  return profile
}

export async function profileBySlug(
  ctx: QueryCtx,
  slug: string,
  tableName: TableNames,
) {
  const user = await ctx.db.query('users').withIndex('by_slug', (q) => q.eq('slug', slug)).unique()
  if (!user) return null
  return profileByUserId(ctx, user._id, tableName)
}

const PROTECTED_FIELDS = new Set([
  'verified',
  'profileComplete',
  'userId',
  '_id',
  '_creationTime',
])

export async function profileUpdate(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  tableName: TableNames,
  role?: string,
) {
  const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })

  const profile = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique()
  if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  const safeArgs: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (!PROTECTED_FIELDS.has(key)) safeArgs[key] = value
  }

  if (role) {
    await assertProfileCompletenessInvariant(
      ctx,
      user._id,
      role,
      profile as unknown as Record<string, unknown>,
      safeArgs,
    )
  }

  await patchDynamic(ctx.db, profile._id, safeArgs)
}

function isRoleFieldSatisfied(
  profile: Record<string, unknown>,
  field: string,
  role: string,
): boolean {
  if (role === 'Boat' && field === 'diveSite') {
    const fleet = profile.fleet as Array<{ routes?: Array<{ diveSite: string }> }> | undefined
    return !!fleet?.some((f) => f.routes?.some((r) => r.diveSite))
  }
  const value = profile[field]
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' && value.trim().length > 0
}

export async function assertProfileCompletenessInvariant(
  ctx: MutationCtx,
  userId: Id<'users'>,
  role: string,
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<void> {
  const roleRow = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .filter((q) => q.eq(q.field('role'), role))
    .unique()
  if (!roleRow?.profileComplete) return

  const merged = { ...existing, ...patch }
  const required = ROLE_REQUIRED[role] ?? []
  const violations = required.filter((field) => !isRoleFieldSatisfied(merged, field, role))
  if (violations.length > 0) {
    throw new ConvexError({
      code: ErrorCode.PROFILE_INCOMPLETE,
      data: { violations },
    })
  }
}

export async function profileCreate(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  tableName: TableNames,
  roleName: string | string[],
  extraDefaults?: Record<string, unknown>,
) {
  const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })

  const roles = Array.isArray(roleName) ? roleName : [roleName]
  const hasAny = await Promise.all(
    roles.map((r) => checkHasRole(ctx, user._id, r)),
  )
  if (!hasAny.some(Boolean)) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }

  const existing = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique()
  if (existing) return existing._id

  const mergedArgs = { ...args }
  if (!mergedArgs.email || (typeof mergedArgs.email === 'string' && mergedArgs.email.trim() === '')) {
    mergedArgs.email = user.email ?? ''
  }
  if (!mergedArgs.phone || (typeof mergedArgs.phone === 'string' && mergedArgs.phone.trim() === '')) {
    mergedArgs.phone = user.phone ?? ''
  }

  return await insertDynamicTable(ctx.db, tableName, {
    ...mergedArgs,
    userId: user._id,
    ...extraDefaults,
  })
}
