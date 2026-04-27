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
import {
  ROLE_SPECS,
  type StakeholderRole,
  type PersonRole,
  type EntityRole,
  isPersonRole,
  isEntityRole,
} from '../shared/roleKinds'
import { assertEntitySlug, mintUniqueEntitySlug } from './entitySlug'

const LANGUAGE_ARRAY_FIELDS: readonly string[] = [
  'customerLanguages',
  'teachingLanguages',
  'languages',
]

export function validateContactInput(args: Record<string, unknown>): void {
  const address = args.address
  if (address && typeof address === 'object' && address !== null) {
    const country = (address as { country?: unknown }).country
    if (typeof country === 'string' && country.length > 0) {
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

const PROTECTED_FIELDS = new Set([
  'verified',
  'userId',
  'organizationId',
  '_id',
  '_creationTime',
])

const ENTITY_SLUG_TABLES = new Set<TableNames>([
  'diveCenters',
  'boats',
  'equipment',
  'venues',
  'compressors',
])

export function assertPersonRole(role: string): asserts role is PersonRole {
  if (!isPersonRole(role)) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `not_person_role:${role}` })
  }
}

export function assertEntityRole(role: string): asserts role is EntityRole {
  if (!isEntityRole(role)) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `not_entity_role:${role}` })
  }
}

type TableForRole<R extends StakeholderRole> = (typeof ROLE_SPECS)[R]['table']

export async function personProfileMine<R extends PersonRole>(
  ctx: QueryCtx,
  role: R,
): Promise<Doc<TableForRole<R>> | null> {
  const activeOrg = await tryGetActiveOrg(ctx)
  if (!activeOrg) return null
  const doc = await queryDynamicTable(ctx.db, ROLE_SPECS[role].table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .unique()
  return doc as Doc<TableForRole<R>> | null
}

export async function personProfileByUser<R extends PersonRole>(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: R,
): Promise<Doc<TableForRole<R>> | null> {
  const user = await ctx.db.get(userId)
  if (!user?.organizationId) return null
  const doc = await queryDynamicTable(ctx.db, ROLE_SPECS[role].table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
    .unique()
  return doc as Doc<TableForRole<R>> | null
}

export async function personProfileBySlug<R extends PersonRole>(
  ctx: QueryCtx,
  orgSlug: string,
  role: R,
): Promise<Doc<TableForRole<R>> | null> {
  const org = await ctx.db
    .query('organizations')
    .withIndex('by_slug', (q) => q.eq('slug', orgSlug))
    .unique()
  if (!org) return null
  const doc = await queryDynamicTable(ctx.db, ROLE_SPECS[role].table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
    .unique()
  return doc as Doc<TableForRole<R>> | null
}

function isActiveRow(row: unknown): boolean {
  return (row as { archivedAt?: number } | null)?.archivedAt === undefined
}

export async function entityProfilesMine<R extends EntityRole>(
  ctx: QueryCtx,
  role: R,
): Promise<Array<Doc<TableForRole<R>>>> {
  const activeOrg = await tryGetActiveOrg(ctx)
  if (!activeOrg) return []
  const docs = await queryDynamicTable(ctx.db, ROLE_SPECS[role].table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .collect() // bounded: per-org entity-role row count, realistic cap ~20
  return (docs as Array<Doc<TableForRole<R>>>).filter(isActiveRow)
}

export async function entityProfilesByUser<R extends EntityRole>(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: R,
): Promise<Array<Doc<TableForRole<R>>>> {
  const user = await ctx.db.get(userId)
  if (!user?.organizationId) return []
  const docs = await queryDynamicTable(ctx.db, ROLE_SPECS[role].table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
    .collect() // bounded: per-org entity-role row count
  return (docs as Array<Doc<TableForRole<R>>>).filter(isActiveRow)
}

export async function entityProfileBySlug<R extends EntityRole>(
  ctx: QueryCtx,
  slug: string,
  role: R,
): Promise<Doc<TableForRole<R>> | null> {
  const doc = await queryDynamicTable(ctx.db, ROLE_SPECS[role].table)
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()
  if (!doc) return null
  if (!isActiveRow(doc as { archivedAt?: number })) return null
  return doc as Doc<TableForRole<R>>
}

export async function personProfileUpdate<R extends PersonRole>(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  role: R,
  actor?: { user: Doc<'users'>; identity: UserIdentity },
): Promise<void> {
  const { user } = await authorize(ctx, actor ?? null, 'profile:manage', { type: 'profile' })
  const { org: activeOrg } = await getActiveOrg(ctx)

  const profile = await queryDynamicTable(ctx.db, ROLE_SPECS[role].table)
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

export async function entityProfileUpdate<R extends EntityRole>(
  ctx: MutationCtx,
  entityId: Id<TableForRole<R>>,
  args: Record<string, unknown>,
  role: R,
  actor?: { user: Doc<'users'>; identity: UserIdentity },
): Promise<void> {
  const { user } = await authorize(ctx, actor ?? null, 'profile:manage', { type: 'profile' })
  const { org: activeOrg } = await getActiveOrg(ctx)

  const profile = await ctx.db.get(entityId as Id<TableNames>)
  if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
  if ((profile as { organizationId?: Id<'organizations'> }).organizationId !== activeOrg._id) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }

  validateContactInput(args)
  const safeArgs: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (!PROTECTED_FIELDS.has(key)) safeArgs[key] = value
  }
  if (typeof safeArgs.slug === 'string') {
    assertEntitySlug(safeArgs.slug)
  }

  await patchDynamic(ctx.db, entityId, safeArgs)
  await setRoleProfileComplete(ctx, user._id, role)
}

export async function personProfileCreate<R extends PersonRole>(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  role: R,
  extraDefaults?: Record<string, unknown>,
  actor?: { user: Doc<'users'>; identity: UserIdentity },
): Promise<Id<TableForRole<R>>> {
  const { user } = await authorize(ctx, actor ?? null, 'profile:manage', { type: 'profile' })
  if (!(await checkHasRole(ctx, user._id, role))) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }
  const { org: activeOrg } = await getActiveOrg(ctx)
  const tableName = ROLE_SPECS[role].table

  const existing = await queryDynamicTable(ctx.db, tableName)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
    .unique()
  if (existing) return existing._id as Id<TableForRole<R>>

  validateContactInput(args)
  const mergedArgs = { ...args }
  if (!mergedArgs.email || (typeof mergedArgs.email === 'string' && mergedArgs.email.trim() === '')) {
    mergedArgs.email = user.email ?? ''
  }
  if (!mergedArgs.phone || (typeof mergedArgs.phone === 'string' && mergedArgs.phone.trim() === '')) {
    mergedArgs.phone = user.phone ?? ''
  }

  const insertedId = await insertDynamicTable(
    ctx.db,
    tableName,
    {
      ...mergedArgs,
      organizationId: activeOrg._id,
      ...extraDefaults,
    } as Parameters<typeof insertDynamicTable>[2],
  )
  await setRoleProfileComplete(ctx, user._id, role)
  return insertedId as Id<TableForRole<R>>
}

export async function entityProfileCreate<R extends EntityRole>(
  ctx: MutationCtx,
  args: Record<string, unknown>,
  role: R,
  extraDefaults?: Record<string, unknown>,
  actor?: { user: Doc<'users'>; identity: UserIdentity },
): Promise<Id<TableForRole<R>>> {
  const { user } = await authorize(ctx, actor ?? null, 'profile:manage', { type: 'profile' })
  if (!(await checkHasRole(ctx, user._id, role))) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }
  const { org: activeOrg } = await getActiveOrg(ctx)
  const tableName = ROLE_SPECS[role].table

  validateContactInput(args)
  const mergedArgs = { ...args }
  if (!mergedArgs.email || (typeof mergedArgs.email === 'string' && mergedArgs.email.trim() === '')) {
    mergedArgs.email = user.email ?? ''
  }
  if (!mergedArgs.phone || (typeof mergedArgs.phone === 'string' && mergedArgs.phone.trim() === '')) {
    mergedArgs.phone = user.phone ?? ''
  }

  const insertPayload: Record<string, unknown> = {
    ...mergedArgs,
    organizationId: activeOrg._id,
    ...extraDefaults,
  }
  if (ENTITY_SLUG_TABLES.has(tableName)) {
    if (insertPayload.slug === undefined) {
      const baseName = typeof mergedArgs.name === 'string' && mergedArgs.name.length > 0
        ? mergedArgs.name
        : `${user.slug}-${role.toLowerCase()}`
      insertPayload.slug = await mintUniqueEntitySlug(ctx, tableName, baseName)
    } else if (typeof insertPayload.slug === 'string') {
      assertEntitySlug(insertPayload.slug)
      const existing = await queryDynamicTable(ctx.db, tableName)
        .withIndex('by_slug', (q) => q.eq('slug', insertPayload.slug as string))
        .unique()
      if (existing) {
        await setRoleProfileComplete(ctx, user._id, role)
        return existing._id as Id<TableForRole<R>>
      }
    }
  }

  const insertedId = await insertDynamicTable(
    ctx.db,
    tableName,
    insertPayload as Parameters<typeof insertDynamicTable>[2],
  )
  await setRoleProfileComplete(ctx, user._id, role)
  return insertedId as Id<TableForRole<R>>
}

export async function personProfileName(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: PersonRole,
): Promise<string> {
  const profile = (await personProfileByUser(ctx, userId, role)) as { name?: string } | null
  return profile?.name ?? ''
}

export async function entityProfileNames(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: EntityRole,
): Promise<string[]> {
  const rows = (await entityProfilesByUser(ctx, userId, role)) as Array<{ name?: string }>
  return rows.map((r) => r.name ?? '').filter(Boolean)
}

export async function getProfileName(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: string,
): Promise<string> {
  if (isPersonRole(role)) return personProfileName(ctx, userId, role)
  if (isEntityRole(role)) {
    const names = await entityProfileNames(ctx, userId, role)
    return names[0] ?? ''
  }
  return ''
}

