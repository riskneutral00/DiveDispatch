import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authorize, getAuthUser, requireAuth } from './lib/auth'
import { requireActiveRole } from './userRoles'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { setRoleProfileComplete, isRoleProfileComplete } from './lib/setRoleProfileComplete'
import { ConvexError } from 'convex/values'
import { ErrorCode } from './lib/errorCodes'

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
      prefsId = await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: user.slug,
        stakeholderType: args.activeRole,
        useNamedUnits: false,
        ...payload,
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
