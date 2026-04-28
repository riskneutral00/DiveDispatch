import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { authorize, getAuthUser, requireAuth } from './lib/auth'
import { tryGetActiveOrg } from './lib/activeOrg'
import { requireActiveRole } from './userRoles'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { setRoleProfileComplete, isRoleProfileComplete } from './lib/setRoleProfileComplete'
import { getAllUserRoles } from './lib/userRoleHelpers'
import { entityProfilesByUser } from './lib/profileHelpers'
import type { StakeholderRole } from './shared/roleKinds'
import { ConvexError } from 'convex/values'
import { ErrorCode } from './lib/errorCodes'

type SelfOwnedSlugs = {
  preferredInstructorSlugs: string[]
  preferredVenueSlugs: string[]
  preferredBoatSlugs: string[]
  preferredEquipmentSlugs: string[]
  preferredCompressorSlugs: string[]
}

export async function selfOwnedResourceSlugs(
  ctx: MutationCtx,
  user: Doc<'users'>,
  activeOrgId: Id<'organizations'>,
): Promise<SelfOwnedSlugs> {
  const roles = await getAllUserRoles(ctx, user._id)
  const has = (r: StakeholderRole) =>
    roles.some((row) => row.role === r && row.organizationId === activeOrgId)

  const venues = has('Venue') ? await entityProfilesByUser(ctx, user._id, 'Venue') : []
  const boats = has('Boat') ? await entityProfilesByUser(ctx, user._id, 'Boat') : []
  const equipment = has('Equipment') ? await entityProfilesByUser(ctx, user._id, 'Equipment') : []
  const compressors = has('Compressor') ? await entityProfilesByUser(ctx, user._id, 'Compressor') : []

  return {
    preferredInstructorSlugs: has('Instructor') ? [user.slug] : [],
    preferredVenueSlugs: venues.map((r) => r.slug).filter((s): s is string => Boolean(s)),
    preferredBoatSlugs: boats.map((r) => r.slug).filter((s): s is string => Boolean(s)),
    preferredEquipmentSlugs: equipment.map((r) => r.slug).filter((s): s is string => Boolean(s)),
    preferredCompressorSlugs: compressors.map((r) => r.slug).filter((s): s is string => Boolean(s)),
  }
}

const acceptanceModeValidator = v.union(
  v.literal('Auto'),
  v.literal('PrePayRequired'),
  v.literal('PostPayAllowed'),
)

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return null

    return await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', user.slug))
      .unique()
  },
})

export const bySlug = query({
  args: { stakeholderSlug: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    return await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', args.stakeholderSlug))
      .unique()
  },
})

export const upsert = mutation({
  args: {
    activeRole: stakeholderType,
    acceptanceMode: acceptanceModeValidator,
    commonLanguageCodes: v.optional(v.array(v.string())),
    preferredInstructorSlugs: v.optional(v.array(v.string())),
    preferredVenueSlugs: v.optional(v.array(v.string())),
    preferredEquipmentSlugs: v.optional(v.array(v.string())),
    preferredBoatSlugs: v.optional(v.array(v.string())),
    preferredCompressorSlugs: v.optional(v.array(v.string())),
    preferredOperatorSlug: v.optional(v.string()),
    confirmOnAccept: v.boolean(),
    confirmOnDecline: v.boolean(),
    autoAssignPreferred: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    await requireActiveRole(ctx, user._id, args.activeRole)

    await assertSlugsComplete(ctx, args.preferredInstructorSlugs ?? [], 'Instructor')
    await assertSlugsComplete(ctx, args.preferredEquipmentSlugs ?? [], 'Equipment')
    await assertSlugsComplete(ctx, args.preferredBoatSlugs ?? [], 'Boat')
    await assertSlugsComplete(ctx, args.preferredCompressorSlugs ?? [], 'Compressor')

    const existing = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', user.slug))
      .unique()

    const payload = {
      acceptanceMode: args.acceptanceMode,
      commonLanguageCodes: args.commonLanguageCodes,
      preferredInstructorSlugs: args.preferredInstructorSlugs,
      preferredVenueSlugs: args.preferredVenueSlugs,
      preferredEquipmentSlugs: args.preferredEquipmentSlugs,
      preferredBoatSlugs: args.preferredBoatSlugs,
      preferredCompressorSlugs: args.preferredCompressorSlugs,
      preferredOperatorSlug: args.preferredOperatorSlug,
      confirmOnAccept: args.confirmOnAccept,
      confirmOnDecline: args.confirmOnDecline,
      autoAssignPreferred: args.autoAssignPreferred,
    }

    let prefsId
    if (existing) {
      await ctx.db.patch(existing._id, payload)
      prefsId = existing._id
    } else {
      const activeOrg = await tryGetActiveOrg(ctx)
      const selfOwned = activeOrg
        ? await selfOwnedResourceSlugs(ctx, user, activeOrg._id)
        : null

      const initial = (
        explicit: string[] | undefined,
        selfKey: keyof SelfOwnedSlugs,
      ): string[] | undefined =>
        explicit !== undefined ? explicit : selfOwned?.[selfKey]

      prefsId = await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: user.slug,
        stakeholderType: args.activeRole,
        useNamedUnits: false,
        ...payload,
        preferredInstructorSlugs: initial(args.preferredInstructorSlugs, 'preferredInstructorSlugs'),
        preferredVenueSlugs: initial(args.preferredVenueSlugs, 'preferredVenueSlugs'),
        preferredBoatSlugs: initial(args.preferredBoatSlugs, 'preferredBoatSlugs'),
        preferredEquipmentSlugs: initial(args.preferredEquipmentSlugs, 'preferredEquipmentSlugs'),
        preferredCompressorSlugs: initial(args.preferredCompressorSlugs, 'preferredCompressorSlugs'),
        autoAssignPreferred: args.autoAssignPreferred ?? true,
      })
    }

    await setRoleProfileComplete(ctx, user._id, args.activeRole)
    return prefsId
  },
})

async function assertSlugsComplete(
  ctx: Parameters<typeof isRoleProfileComplete>[0],
  slugs: string[],
  role: string,
): Promise<void> {
  for (const slug of slugs) {
    const complete = await isRoleProfileComplete(ctx, slug, role) // batch-exempt: tiny bounded per-operator preferred lists
    if (!complete) {
      throw new ConvexError({ code: ErrorCode.PROFILE_INCOMPLETE, slug, role })
    }
  }
}
