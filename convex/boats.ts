import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  archiveEntityProfile,
  entityProfilesMine,
  entityProfileUpdate,
  entityProfileCreate,
  queryVisibleEntities,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'
import { gasMixValidator } from './shared/gasMixes'
import { validateNitroxRange } from './lib/gasMixValidation'

const GAS_MIX_FIELDS = {
  gasMixes: v.optional(v.array(gasMixValidator)),
  nitroxMin: v.optional(v.number()),
  nitroxMax: v.optional(v.number()),
}

const boatTypeValidator = v.union(
  v.literal('day_boat'),
  v.literal('speedboat'),
  v.literal('longtail'),
  v.literal('liveaboard'),
  v.literal('catamaran'),
  v.literal('rib'),
)

const fleetEntryValidator = v.object({
  boatName: v.string(),
  maxPax: v.number(),
  minPax: v.optional(v.number()),
  boatType: boatTypeValidator,
  seatCapacity: v.optional(v.number()),
  routes: v.optional(
    v.array(
      v.object({
        venueIds: v.array(v.id('venues')),
        daysOfWeek: v.array(v.number()),
      }),
    ),
  ),
  cutoffHours: v.optional(v.number()),
})

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    fleet: v.array(fleetEntryValidator),
    ...GAS_MIX_FIELDS,
  },
  handler: async (ctx, args) => {
    validateNitroxRange(args)
    return entityProfileCreate(ctx, args, 'Boat', { verified: false })
  },
})

export const update = mutation({
  args: {
    entityId: v.id('boats'),
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    fleet: v.optional(v.array(fleetEntryValidator)),
    ...GAS_MIX_FIELDS,
  },
  handler: async (ctx, args) => {
    validateNitroxRange(args)
    const { entityId, ...patch } = args
    return entityProfileUpdate(ctx, entityId, patch, 'Boat')
  },
})

export const archive = mutation({
  args: { entityId: v.id('boats') },
  handler: async (ctx, { entityId }) => {
    await archiveEntityProfile(ctx, entityId, 'Boat')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => entityProfilesMine(ctx, 'Boat'),
})

export const visibleToMe = query({
  args: {},
  handler: async (ctx) => queryVisibleEntities(ctx, 'Boat'),
})
