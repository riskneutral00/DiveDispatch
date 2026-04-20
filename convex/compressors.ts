import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'
import { gasMixValidator } from './shared/gasMixes'
import { ErrorCode } from './lib/errorCodes'

function validateNitroxRange(args: { nitroxMin?: number; nitroxMax?: number }) {
  if (args.nitroxMin !== undefined || args.nitroxMax !== undefined) {
    const min = args.nitroxMin ?? 21
    const max = args.nitroxMax ?? 40
    if (min < 21 || max > 40 || min > max) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'nitroxMin must be 21–40, nitroxMax must be 21–40, min ≤ max' })
    }
  }
}

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    gasMixes: v.optional(v.array(gasMixValidator)),
    nitroxMin: v.optional(v.number()),
    nitroxMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    validateNitroxRange(args)
    return profileCreate(ctx, args, 'compressors', 'Compressor', {
      verified: false,
    })
  },
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    gasMixes: v.optional(v.array(gasMixValidator)),
    nitroxMin: v.optional(v.number()),
    nitroxMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    validateNitroxRange(args)
    return profileUpdate(ctx, args, 'compressors', 'Compressor')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'compressors'),
})
