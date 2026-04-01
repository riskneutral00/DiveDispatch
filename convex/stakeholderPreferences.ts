import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ErrorCode } from './lib/errorCodes'
import { requireAuth } from './lib/auth'
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

/** Read-only preferences for another stakeholder (e.g. target operator in referral / preferred operator cascade). */
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

/** Inserts default `useNamedUnits: false` on first create. `noWorkAfterTime` exists on the table but is not in args yet — reserved for future scheduling UI. */
export const upsert = mutation({
  args: {
    activeRole: stakeholderType,
    acceptanceMode: acceptanceModeValidator,
    maxHoursPerDay: v.number(),
    postJobBlockDuration: v.number(),
    commonLanguageCodes: v.optional(v.array(v.string())),
    preferredInstructorSlugs: v.optional(v.array(v.string())),
    preferredVenueSlugs: v.optional(v.array(v.string())),
    preferredEquipmentSlugs: v.optional(v.array(v.string())),
    preferredBoatSlugs: v.optional(v.array(v.string())),
    preferredCompressorSlugs: v.optional(v.array(v.string())),
    preferredOperatorSlug: v.optional(v.string()),
    confirmOnAccept: v.boolean(),
    confirmOnDecline: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    if (args.maxHoursPerDay < 1 || args.maxHoursPerDay > 16) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'maxHoursPerDay must be between 1 and 16' })
    }
    if (args.postJobBlockDuration < 0 || args.postJobBlockDuration > 480) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'postJobBlockDuration must be between 0 and 480' })
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    await requireActiveRole(ctx, user._id, args.activeRole)

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
      preferredOperatorSlug: args.preferredOperatorSlug,
      confirmOnAccept: args.confirmOnAccept,
      confirmOnDecline: args.confirmOnDecline,
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
    })
  },
})
