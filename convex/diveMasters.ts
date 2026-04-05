import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS } from './lib/validators'

const credentialValidator = v.object({
  agency: v.string(),
  level: v.string(),
  agencyID: v.string(),
})

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    credential: v.array(credentialValidator),
    teachingLanguages: v.array(v.string()),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'diveMasters', 'DiveMaster', {
      verified: false,
    }),
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    credential: v.optional(v.array(credentialValidator)),
    teachingLanguages: v.optional(v.array(v.string())),
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
