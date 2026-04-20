import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc, Id, TableNames } from '../_generated/dataModel'
import { authorize } from './auth'
import { checkHasRole } from '../userRoles'
import { ErrorCode } from './errorCodes'
import { queryDynamicTable, insertDynamicTable, patchDynamic } from './typedDb'
import { getActiveOrg, tryGetActiveOrg } from './activeOrg'
import { assertCountryCode } from './i18nValidators'

function validateStructuredAddress(args: Record<string, unknown>): void {
  const address = args.address
  if (address && typeof address === 'object' && address !== null) {
    const country = (address as { country?: unknown }).country
    if (typeof country === 'string') {
      assertCountryCode(country, 'address.country')
    }
  }
}

export const ROLE_TABLE_MAP: Record<string, TableNames> = {
  Instructor: 'diveStaff',
  Boat: 'boats',
  Equipment: 'equipment',
  Pool: 'venues',
  DiveSite: 'venues',
  Compressor: 'compressors',
  DiveCenter: 'diveCenters',
  Agent: 'agents',
  Liveaboard: 'liveaboards',
  DiveResort: 'diveResorts',
  DiveHostel: 'diveHostels',
}

export async function profileMine<T extends TableNames>(
  ctx: QueryCtx,
  tableName: T,
): Promise<Doc<T> | null> {
  const activeOrg = await tryGetActiveOrg(ctx)
  if (!activeOrg) return null

  const doc = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .unique()
  return doc as Doc<T> | null
}

export async function profileBySlug<T extends TableNames>(
  ctx: QueryCtx,
  slug: string,
  tableName: T,
): Promise<Doc<T> | null> {
  const org = await ctx.db
    .query('organizations')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()
  if (!org) return null
  const doc = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
    .unique()
  return doc as Doc<T> | null
}

export async function profileByUser<T extends TableNames>(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tableName: T,
): Promise<Doc<T> | null> {
  const user = await ctx.db.get(userId)
  if (!user) return null
  return profileBySlug(ctx, user.slug, tableName)
}

const PROTECTED_FIELDS = new Set([
  'verified',
  'userId',
  'organizationId',
  '_id',
  '_creationTime',
])

export async function profileUpdate(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  tableName: TableNames,
  role?: string,
) {
  await authorize(ctx, null, 'profile:manage', { type: 'profile' })
  const { org: activeOrg } = await getActiveOrg(ctx)

  const profile = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .unique()
  if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  validateStructuredAddress(args)

  const safeArgs: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (!PROTECTED_FIELDS.has(key)) safeArgs[key] = value
  }

  await patchDynamic(ctx.db, profile._id, safeArgs)
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

  const { org: activeOrg } = await getActiveOrg(ctx)

  const existing = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .unique()
  if (existing) return existing._id

  validateStructuredAddress(args)

  const mergedArgs = { ...args }
  if (!mergedArgs.email || (typeof mergedArgs.email === 'string' && mergedArgs.email.trim() === '')) {
    mergedArgs.email = user.email ?? ''
  }
  if (!mergedArgs.phone || (typeof mergedArgs.phone === 'string' && mergedArgs.phone.trim() === '')) {
    mergedArgs.phone = user.phone ?? ''
  }

  return await insertDynamicTable(ctx.db, tableName, {
    ...mergedArgs,
    organizationId: activeOrg._id,
    ...extraDefaults,
  })
}

export async function getProfileName(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: string,
): Promise<string> {
  const tableName = ROLE_TABLE_MAP[role]
  if (!tableName) return ''
  const profile = await profileByUser(ctx, userId, tableName) as unknown as { name?: string } | null
  return profile?.name ?? ''
}
