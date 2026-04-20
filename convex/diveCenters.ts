import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'

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
    ...BUSINESS_NAME_CREATE_FIELD,
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
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    associations: v.optional(v.array(associationValidator)),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'diveCenters'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'diveCenters'),
})
