import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'

const associationValidator = v.object({ agency: v.string(), number: v.string() })

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    associations: v.array(associationValidator),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'agents', 'Agent', {
      verified: false,
    }),
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    associations: v.optional(v.array(associationValidator)),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'agents'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'agents'),
})
