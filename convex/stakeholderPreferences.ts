import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

const acceptanceModeValidator = v.union(
  v.literal('Auto'),
  v.literal('PrePayRequired'),
  v.literal('PostPayAllowed'),
)

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) return null

    return await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', user.slug))
      .unique()
  },
})

export const upsert = mutation({
  args: {
    acceptanceMode: acceptanceModeValidator,
    maxHoursPerDay: v.number(),
    postJobBlockDuration: v.number(),
    commonLanguageCodes: v.array(v.string()),
    preferredInstructorSlugs: v.optional(v.array(v.string())),
    preferredVenueSlugs: v.optional(v.array(v.string())),
    preferredEquipmentSlugs: v.optional(v.array(v.string())),
    preferredBoatSlugs: v.optional(v.array(v.string())),
    preferredCompressorSlugs: v.optional(v.array(v.string())),
    confirmOnAccept: v.boolean(),
    confirmOnDecline: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    if (args.maxHoursPerDay < 1 || args.maxHoursPerDay > 16) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', reason: 'maxHoursPerDay must be between 1 and 16' })
    }
    if (args.postJobBlockDuration < 0 || args.postJobBlockDuration > 480) {
      throw new ConvexError({ code: 'VALIDATION_ERROR', reason: 'postJobBlockDuration must be between 0 and 480' })
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: 'NOT_FOUND' })

    const existing = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', user.slug))
      .unique()

    const payload = {
      acceptanceMode: args.acceptanceMode,
      maxHoursPerDay: args.maxHoursPerDay,
      postJobBlockDuration: args.postJobBlockDuration,
      commonLanguageCodes: args.commonLanguageCodes,
      preferredInstructorSlugs: args.preferredInstructorSlugs,
      preferredVenueSlugs: args.preferredVenueSlugs,
      preferredEquipmentSlugs: args.preferredEquipmentSlugs,
      preferredBoatSlugs: args.preferredBoatSlugs,
      preferredCompressorSlugs: args.preferredCompressorSlugs,
      confirmOnAccept: args.confirmOnAccept,
      confirmOnDecline: args.confirmOnDecline,
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert('stakeholderPreferences', {
      stakeholderId: user.slug,
      stakeholderType: user.role,
      useNamedUnits: false,
      ...payload,
    })
  },
})
