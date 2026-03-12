import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

const locationValidator = v.object({ city: v.string(), country: v.string() })

const associationValidator = v.object({ agency: v.string(), number: v.string() })

export const create = mutation({
  args: {
    name: v.string(),
    locations: v.array(locationValidator),
    contactEmail: v.string(),
    contactPhone: v.string(),
    associations: v.array(associationValidator),
    focusedLanguages: v.array(v.string()),
    defaultReferralMode: v.union(v.literal('independent'), v.literal('referral')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: 'NOT_FOUND' })
    if (user.role !== 'Agent') throw new ConvexError({ code: 'FORBIDDEN' })

    const existing = await ctx.db
      .query('agents')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (existing) return existing._id

    return await ctx.db.insert('agents', { ...args, userId: user._id, verified: false })
  },
})

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    locations: v.optional(v.array(locationValidator)),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    associations: v.optional(v.array(associationValidator)),
    focusedLanguages: v.optional(v.array(v.string())),
    defaultReferralMode: v.optional(
      v.union(v.literal('independent'), v.literal('referral')),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: 'NOT_FOUND' })

    const profile = await ctx.db
      .query('agents')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!profile) throw new ConvexError({ code: 'NOT_FOUND' })

    await ctx.db.patch(profile._id, args)
  },
})

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

    const agent = await ctx.db
      .query('agents')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!agent) return null

    // Normalize: expose flat city/country from locations[0] for consumers that expect it
    const primary = agent.locations[0]
    return {
      ...agent,
      city: primary?.city ?? '',
      country: primary?.country ?? '',
    }
  },
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique()
  },
})
