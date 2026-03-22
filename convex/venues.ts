import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, getAuthUser } from './lib/auth'

export const create = mutation({
  args: {
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    focusedLanguages: v.array(v.string()),
    venueType: v.string(),
    isPublic: v.boolean(),
    confinedCapable: v.boolean(),
    openWaterCapable: v.boolean(),
    hasCompressor: v.boolean(),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    if (user.role !== 'Pool' && user.role !== 'DiveSite')
      throw new ConvexError({ code: 'FORBIDDEN' })

    const existing = await ctx.db
      .query('venues')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (existing) return existing._id

    return await ctx.db.insert('venues', {
      ...args,
      venueType: args.venueType as 'Pool' | 'Shore' | 'Reef' | 'Lake' | 'River' | 'Quarry' | 'Other',
      userId: user._id,
      verified: false,
    })
  },
})

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    focusedLanguages: v.optional(v.array(v.string())),
    venueType: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    confinedCapable: v.optional(v.boolean()),
    openWaterCapable: v.optional(v.boolean()),
    hasCompressor: v.optional(v.boolean()),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)

    const profile = await ctx.db
      .query('venues')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!profile) throw new ConvexError({ code: 'NOT_FOUND' })

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
    return await ctx.db
      .query('venues')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique()
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return null

    return await ctx.db
      .query('venues')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  },
})
