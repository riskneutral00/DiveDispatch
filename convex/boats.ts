import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'

const boatTypeValidator = v.union(
  v.literal('day_boat'),
  v.literal('speedboat'),
  v.literal('longtail'),
  v.literal('liveaboard'),
  v.literal('catamaran'),
  v.literal('rib'),
)

const fleetEntryValidator = v.object({
  boatName: v.string(),
  maxPax: v.number(),
  minPax: v.optional(v.number()),
  boatType: boatTypeValidator,
  seatCapacity: v.optional(v.number()),
  routes: v.optional(
    v.array(
      v.object({
        diveSite: v.string(),
        daysOfWeek: v.array(v.number()),
      }),
    ),
  ),
  cutoffHours: v.optional(v.number()),
})

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
    fleet: v.array(fleetEntryValidator),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'boats', 'Boat', {
      hasCompressor: false,
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
    fleet: v.optional(v.array(fleetEntryValidator)),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'boats'),
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => profileByUserId(ctx, args.userId, 'boats'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'boats'),
})
