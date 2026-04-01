import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'

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
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'agents', 'Agent', {
      verified: false,
    }),
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
  handler: async (ctx, args) => profileUpdate(ctx, args, 'agents'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'agents'),
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => profileByUserId(ctx, args.userId, 'agents'),
})
