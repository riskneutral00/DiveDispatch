import type { GenericMutationCtx, GenericActionCtx } from 'convex/server'
import type { DataModel, Doc } from '../../convex/_generated/dataModel'
import type { StakeholderRole } from '../../convex/lib/validators'
import { TEST_TOKENS, TEST_SLUGS } from '../helpers/testData'

export type SeedCtx = GenericMutationCtx<DataModel> &
  Pick<GenericActionCtx<DataModel>, 'storage'>

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
    isSeeded?: boolean
    skipUserRoles?: boolean
  } = {},
) {
  const role = overrides.role ?? 'DiveCenter'
  const userId = await ctx.db.insert('users', {
    tokenIdentifier: overrides.tokenIdentifier ?? TEST_TOKENS.diveCenter,
    slug: overrides.slug ?? TEST_SLUGS.diveCenter,
    email: overrides.email ?? 'test@test.com',
    name: overrides.name ?? 'Test User',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    phone: '+66812345678',
    dateOfBirth: '1990-01-01',
    isSeeded: overrides.isSeeded ?? true,
    appLanguage: 'en',
  })
  if (!overrides.skipUserRoles) {
    await ctx.db.insert('userRoles', {
      userId,
      role,
      createdAt: Date.now(),
    })
  }
  return userId
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
