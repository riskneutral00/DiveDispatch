import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'

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
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'diveMasters', 'DiveMaster', {
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
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    credential: v.optional(v.array(credentialValidator)),
    languages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'diveMasters'),
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) =>
    profileByUserId(ctx, args.userId, 'diveMasters'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'diveMasters'),
})
