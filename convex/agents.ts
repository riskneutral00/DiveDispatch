import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, getAuthUser } from './lib/auth'
import { checkHasRole } from './userRoles'
import { ErrorCode } from './lib/errorCodes'

const associationValidator = v.object({ agency: v.string(), number: v.string() })

export const create = mutation({
  args: {
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    email: v.string(),
    phone: v.string(),
    associations: v.array(associationValidator),
    defaultReferralMode: v.union(v.literal('independent'), v.literal('referral')),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Agent')) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

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
    placeName: v.optional(v.string()),
    country: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    placeId: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    associations: v.optional(v.array(associationValidator)),
    defaultReferralMode: v.optional(
      v.union(v.literal('independent'), v.literal('referral')),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)

    const profile = await ctx.db
      .query('agents')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    await ctx.db.patch(profile._id, args)
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return null

    return await ctx.db
      .query('agents')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
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

