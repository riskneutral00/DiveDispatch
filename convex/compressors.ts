import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'

const gasMixValidator = v.union(
  v.literal('air'),
  v.literal('nitrox'),
  v.literal('trimix'),
)

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
    gasMixes: v.optional(v.array(gasMixValidator)),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'compressors', 'Compressor', {
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
    gasMixes: v.optional(v.array(gasMixValidator)),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'compressors'),
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) =>
    profileByUserId(ctx, args.userId, 'compressors'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'compressors'),
})
