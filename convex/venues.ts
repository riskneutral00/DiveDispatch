import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { profileByUserId, profileMine } from './lib/profileHelpers'
import { checkHasRole } from './userRoles'
import { ErrorCode } from './lib/errorCodes'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS } from './lib/validators'

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    venueType: v.string(),
    confinedCapable: v.boolean(),
    hasCompressor: v.boolean(),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Pool') && !await checkHasRole(ctx, user._id, 'DiveSite'))
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    const existing = await ctx.db
      .query('venues')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (existing) return existing._id

    const venueId = await ctx.db.insert('venues', {
      ...args,
      venueType: args.venueType as 'Pool' | 'Shore' | 'Reef' | 'Lake' | 'River' | 'Quarry' | 'Other',
      userId: user._id,
      verified: false,
    })

    // Auto-create inventoryUnit for owned DiveSite accounts
    if (await checkHasRole(ctx, user._id, 'DiveSite')) {
      await ctx.db.insert('inventoryUnits', {
        resourceType: 'DiveSite',
        resourceId: user.slug,
        displayName: args.name,
        capacityModel: 'Pooled',
        totalUnits: Math.max(1, args.maxCapacity ?? 1),
        ownerId: user.slug,
        ownerType: 'DiveSite',
      })
    }

    return venueId
  },
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    venueType: v.optional(v.string()),
    confinedCapable: v.optional(v.boolean()),
    hasCompressor: v.optional(v.boolean()),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)

    const profile = await profileByUserId(ctx, user._id, 'venues')
    if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { venueType, ...rest } = args
    const patch: Record<string, unknown> = { ...rest }
    if (venueType) {
      patch.venueType = venueType as 'Pool' | 'Shore' | 'Reef' | 'Lake' | 'River' | 'Quarry' | 'Other'
    }
    await ctx.db.patch(profile._id, patch)
  },
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await profileByUserId(ctx, args.userId, 'venues')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    return await profileMine(ctx, 'venues')
  },
})
