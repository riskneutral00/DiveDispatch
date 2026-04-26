import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  entityProfilesMine,
  entityProfileUpdate,
  entityProfileCreate,
} from './lib/profileHelpers'
import { authorize, assertOrgOwnership } from './lib/auth'
import { getActiveOrg } from './lib/activeOrg'
import { setRoleProfileComplete } from './lib/setRoleProfileComplete'
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
    entityId: v.id('diveCenters'),
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    associations: v.optional(v.array(associationValidator)),
    customerLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { entityId, ...patch } = args
    return entityProfileUpdate(ctx, entityId, patch, 'DiveCenter')
  },
})

export const archive = mutation({
  args: { entityId: v.id('diveCenters') },
  handler: async (ctx, { entityId }) => {
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const row = await ctx.db.get(entityId)
    if (!row) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    const { org: activeOrg } = await getActiveOrg(ctx)
    assertOrgOwnership(row, activeOrg)
    await ctx.db.patch(entityId, { archivedAt: Date.now() })
    await setRoleProfileComplete(ctx, user._id, 'DiveCenter')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => entityProfilesMine(ctx, 'DiveCenter'),
})
