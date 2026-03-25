import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'

const bookingPreferencesValidator = v.object({
  owDays: v.optional(v.number()),
  aowDays: v.optional(v.number()),
  oaDays: v.optional(v.number()),
  aowSpecialties: v.optional(v.array(v.string())),
})

const associationValidator = v.object({ agency: v.string(), number: v.string() })

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
    associations: v.array(associationValidator),
    bookingPreferences: v.optional(bookingPreferencesValidator),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'diveCenters', 'DiveCenter', {
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
    associations: v.optional(v.array(associationValidator)),
    bookingPreferences: v.optional(bookingPreferencesValidator),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'diveCenters'),
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) =>
    profileByUserId(ctx, args.userId, 'diveCenters'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'diveCenters'),
})
