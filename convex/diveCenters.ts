import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  entityProfilesMine,
  entityProfilesByUser,
  entityProfileUpdate,
  entityProfileCreate,
} from './lib/profileHelpers'
import { authorize } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
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
    entityProfileCreate(ctx, args, 'DiveCenter', { verified: false }),
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    associations: v.optional(v.array(associationValidator)),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const actor = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const rows = await entityProfilesByUser(ctx, actor.user._id, 'DiveCenter')
    const target = rows[0]
    if (!target) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    return entityProfileUpdate(ctx, target._id, args, 'DiveCenter', actor)
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const rows = await entityProfilesMine(ctx, 'DiveCenter')
    return rows[0] ?? null
  },
})
