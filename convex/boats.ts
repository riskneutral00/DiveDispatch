import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS } from './lib/validators'

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
        diveSite: v.string(),
        daysOfWeek: v.array(v.number()),
      }),
    ),
  ),
  cutoffHours: v.optional(v.number()),
})

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...ACCESS_CONTROL_FIELDS,
    fleet: v.array(fleetEntryValidator),
  },
  handler: async (ctx, args) => {
    const hasCompressor = args.fleet.some(
      (v) => v.boatType === 'day_boat' || v.boatType === 'liveaboard',
    )
    return profileCreate(ctx, args, 'boats', 'Boat', {
      hasCompressor,
      verified: false,
    })
  },
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...ACCESS_CONTROL_FIELDS,
    fleet: v.optional(v.array(fleetEntryValidator)),
    hasCompressor: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { hasCompressor, ...rest } = args
    const extras: Record<string, boolean> = {}
    if (hasCompressor !== undefined) {
      extras.hasCompressor = hasCompressor
    } else if (rest.fleet) {
      extras.hasCompressor = rest.fleet.some(
        (v) => v.boatType === 'day_boat' || v.boatType === 'liveaboard',
      )
    }
    return profileUpdate(ctx, { ...rest, ...extras }, 'boats')
  },
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => profileByUserId(ctx, args.userId, 'boats'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'boats'),
})
