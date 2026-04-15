import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS } from './lib/validators'

const associationValidator = v.object({
  agency: v.string(),
  number: v.string(),
  owDays: v.optional(v.number()),
  aowDays: v.optional(v.number()),
  oaDays: v.optional(v.number()),
  selectedSpecialties: v.optional(v.array(v.string())),
})

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...ACCESS_CONTROL_FIELDS,
    associations: v.array(associationValidator),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'diveCenters', 'DiveCenter', {
      verified: false,
    }),
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...ACCESS_CONTROL_FIELDS,
    associations: v.optional(v.array(associationValidator)),
    customerLanguages: v.optional(v.array(v.string())),
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
