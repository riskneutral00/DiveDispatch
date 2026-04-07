import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authorize, getAuthUser, requireAuth } from './lib/auth'
import { requireActiveRole } from './userRoles'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'

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

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert('stakeholderPreferences', {
      stakeholderId: user.slug,
      stakeholderType: args.activeRole,
      useNamedUnits: false,
      ...payload,
      autoAssignPreferred: args.autoAssignPreferred ?? true,
    })
  },
})
