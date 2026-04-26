import type { GenericMutationCtx, GenericActionCtx } from 'convex/server'
import type { DataModel, Doc, Id, TableNames } from '../../convex/_generated/dataModel'
import type { StakeholderRole } from '../../convex/lib/validators'
import { TEST_TOKENS, TEST_SLUGS } from '../helpers/testData'

export type SeedCtx = GenericMutationCtx<DataModel> &
  Pick<GenericActionCtx<DataModel>, 'storage'>

export async function getOrCreateTestOrg(
  ctx: SeedCtx,
  userId: Id<'users'>,
  orgName?: string,
): Promise<Id<'organizations'>> {
  const user = await ctx.db.get(userId)
  if (!user) throw new Error(`getOrCreateTestOrg: user ${userId} not found`)
  const clerkOrgId = `test_${user.slug}`
  const existing = await ctx.db
    .query('organizations')
    .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
  if (existing) {
    if (!user.organizationId) {
      await ctx.db.patch(userId, { organizationId: existing._id })
    }
    return existing._id
  }
  const now = Date.now()
  const orgId = await ctx.db.insert('organizations', {
    clerkOrgId,
    name: orgName ?? `Test Org for ${user.slug}`,
    slug: user.slug,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(userId, { organizationId: orgId })
  return orgId
}

export async function findProfileByUser<T extends TableNames>(
  ctx: SeedCtx,
  userId: Id<'users'>,
  tableName: T,
): Promise<Doc<T> | null> {
  const user = await ctx.db.get(userId)
  if (!user?.organizationId) return null
  const doc = await ctx.db
    .query(tableName as 'diveCenters')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
    .unique()
  return doc as Doc<T> | null
}

export async function rebindUserToOrg(
  ctx: SeedCtx,
  tokenIdentifier: string,
  newOrgId: Id<'organizations'>,
): Promise<void> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .unique()
  if (!user) return
  await ctx.db.patch(user._id, { organizationId: newOrgId })
  const roles = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .collect()
  for (const r of roles) {
    if (r.organizationId !== newOrgId) {
      await ctx.db.patch(r._id, { organizationId: newOrgId })
    }
  }
}

export async function seedUser(
  ctx: SeedCtx,
  overrides: {
    tokenIdentifier?: string
    slug?: string
    role?: Doc<'userRoles'>['role']
    email?: string
    name?: string
    firstName?: string
    lastName?: string
    skipUserRoles?: boolean
  } = {},
) {
  const role = overrides.role ?? 'DiveCenter'
  const token = overrides.tokenIdentifier ?? TEST_TOKENS.diveCenter
  const userId = await ctx.db.insert('users', {
    tokenIdentifier: token,
    originalTokenIdentifier: token,
    slug: overrides.slug ?? TEST_SLUGS.diveCenter,
    email: overrides.email ?? 'test@test.com',
    name: overrides.name ?? 'Test User',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    phone: '+66812345678',
    dateOfBirth: '1990-01-01',
    appLanguage: 'en',
  })
  if (!overrides.skipUserRoles) {
    const orgId = await getOrCreateTestOrg(ctx, userId)
    await ctx.db.insert('userRoles', {
      userId,
      role,
      organizationId: orgId,
      permissionLevel: 'admin',
      createdAt: Date.now(),
    })
  }
  return userId
}

export async function seedUserWithOrg(
  ctx: SeedCtx,
  slug: string,
  role: Doc<'userRoles'>['role'],
  options: { skipUserRoles?: boolean } = {},
): Promise<Id<'users'>> {
  return await seedUser(ctx, {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    role,
    skipUserRoles: options.skipUserRoles,
  })
}

export async function seedBlockedDates(
  ctx: SeedCtx,
  opts: { stakeholderId: string; roleType: StakeholderRole; dates: string[] },
) {
  return ctx.db.insert('stakeholderBlockedDates', {
    stakeholderId: opts.stakeholderId,
    roleType: opts.roleType,
    dates: opts.dates,
  })
}
