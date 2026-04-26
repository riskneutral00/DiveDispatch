import { ConvexError } from 'convex/values'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { UserIdentity } from 'convex/server'
import { authorize } from './auth'
import { checkHasRole } from '../userRoles'
import { ErrorCode } from './errorCodes'
import { queryDynamicTable, insertDynamicTable, patchDynamic } from './typedDb'
import { getActiveOrg, tryGetActiveOrg } from './activeOrg'
import { assertCountryCode, assertPhoneE164, assertLanguageCodes } from './validators'
import { setRoleProfileComplete } from './setRoleProfileComplete'
import { ROLE_SPECS, type StakeholderRole } from '../shared/roleKinds'

const LANGUAGE_ARRAY_FIELDS: readonly string[] = [
  'customerLanguages',
  'teachingLanguages',
  'languages',
]

export function validateContactInput(args: Record<string, unknown>): void {
  const address = args.address
  if (address && typeof address === 'object' && address !== null) {
    const country = (address as { country?: unknown }).country
    if (typeof country === 'string') {
      assertCountryCode(country, 'address.country')
    }
  }

  const phone = args.phone
  if (typeof phone === 'string' && phone.length > 0) {
    assertPhoneE164(phone, 'phone')
  }

  for (const field of LANGUAGE_ARRAY_FIELDS) {
    const codes = args[field]
    if (Array.isArray(codes) && codes.length > 0) {
      assertLanguageCodes(codes as string[], field)
    }
  }
}

export const ROLE_TABLE_MAP: Record<string, TableNames> = Object.fromEntries(
  (Object.entries(ROLE_SPECS) as Array<[StakeholderRole, (typeof ROLE_SPECS)[StakeholderRole]]>)
    .map(([role, spec]) => [role, spec.table]),
) as Record<string, TableNames>

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

export async function profileMineMulti<T extends TableNames>(
  ctx: QueryCtx,
  tableName: T,
): Promise<Doc<T>[]> {
  const activeOrg = await tryGetActiveOrg(ctx)
  if (!activeOrg) return []

  const docs = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .collect() // bounded: per-org venue count, realistic cap ~20
  return docs as Doc<T>[]
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
  if (!user?.organizationId) return null
  const doc = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
    .unique()
  return doc as Doc<T> | null
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
  role: string,
  actor?: { user: Doc<'users'>; identity: UserIdentity },
) {
  const { user } = await authorize(ctx, actor ?? null, 'profile:manage', { type: 'profile' })
  const { org: activeOrg } = await getActiveOrg(ctx)

  const profile = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .unique()
  if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  validateContactInput(args)

  const safeArgs: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (!PROTECTED_FIELDS.has(key)) safeArgs[key] = value
  }

  await patchDynamic(ctx.db, profile._id, safeArgs)

  await setRoleProfileComplete(ctx, user._id, role)
}

export async function profileCreate(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  tableName: TableNames,
  roleName: string | string[],
  extraDefaults?: Record<string, unknown>,
  actor?: { user: Doc<'users'>; identity: UserIdentity },
) {
  const { user } = await authorize(ctx, actor ?? null, 'profile:manage', { type: 'profile' })

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

  validateContactInput(args)

  const mergedArgs = { ...args }
  if (!mergedArgs.email || (typeof mergedArgs.email === 'string' && mergedArgs.email.trim() === '')) {
    mergedArgs.email = user.email ?? ''
  }
  if (!mergedArgs.phone || (typeof mergedArgs.phone === 'string' && mergedArgs.phone.trim() === '')) {
    mergedArgs.phone = user.phone ?? ''
  }

  const insertedId = await insertDynamicTable(ctx.db, tableName, {
    ...mergedArgs,
    organizationId: activeOrg._id,
    ...extraDefaults,
  })

  for (const r of roles) {
    await setRoleProfileComplete(ctx, user._id, r)
  }

  return insertedId
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
