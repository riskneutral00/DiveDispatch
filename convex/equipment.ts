import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'

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
    manufacturersByGearType: v.optional(v.record(v.string(), v.array(v.string()))),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'equipment', 'Equipment', { verified: false }),
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
    manufacturersByGearType: v.optional(v.record(v.string(), v.array(v.string()))),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'equipment'),
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) =>
    profileByUserId(ctx, args.userId, 'equipment'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'equipment'),
})
