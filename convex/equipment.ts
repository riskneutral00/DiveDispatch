import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS } from './lib/validators'

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    manufacturersByGearType: v.optional(v.record(v.string(), v.array(v.string()))),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'equipment', 'Equipment', { verified: false }),
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
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
