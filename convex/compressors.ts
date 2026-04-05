import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS } from './lib/validators'

const gasMixValidator = v.union(
  v.literal('air'),
  v.literal('nitrox'),
  v.literal('trimix'),
)

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    gasMixes: v.optional(v.array(gasMixValidator)),
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'compressors', 'Compressor', {
      verified: false,
    }),
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    gasMixes: v.optional(v.array(gasMixValidator)),
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'compressors'),
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) =>
    profileByUserId(ctx, args.userId, 'compressors'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'compressors'),
})
