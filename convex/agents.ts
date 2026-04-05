import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS } from './lib/validators'

const associationValidator = v.object({ agency: v.string(), number: v.string() })

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
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
    ...BASE_PROFILE_UPDATE_FIELDS,
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
