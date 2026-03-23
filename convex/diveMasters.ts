import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, getAuthUser } from './lib/auth'

const credentialValidator = v.object({
  agency: v.string(),
  level: v.string(),
  agencyID: v.string(),
})

export const create = mutation({
  args: {
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
    credential: v.array(credentialValidator),
    languages: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)
    if (user.role !== 'DiveMaster') throw new ConvexError({ code: 'FORBIDDEN' })

    const existing = await ctx.db
      .query('diveMasters')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (existing) return existing._id

    return await ctx.db.insert('diveMasters', { ...args, userId: user._id, verified: false })
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
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    credential: v.optional(v.array(credentialValidator)),
    languages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx)

    const profile = await ctx.db
      .query('diveMasters')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!profile) throw new ConvexError({ code: 'NOT_FOUND' })

    await ctx.db.patch(profile._id, args)
  },
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('diveMasters')
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
      .query('diveMasters')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  },
})
