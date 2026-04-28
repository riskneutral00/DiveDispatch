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

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
  },
  handler: async (ctx, args) =>
    entityProfileCreate(ctx, args, 'Equipment', { verified: false }),
})

export const update = mutation({
  args: {
    entityId: v.id('equipment'),
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
  },
  handler: async (ctx, args) => {
    const { entityId, ...patch } = args
    return entityProfileUpdate(ctx, entityId, patch, 'Equipment')
  },
})

export const archive = mutation({
  args: { entityId: v.id('equipment') },
  handler: async (ctx, { entityId }) => {
    await archiveEntityProfile(ctx, entityId, 'Equipment')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => entityProfilesMine(ctx, 'Equipment'),
})

export const visibleToMe = query({
  args: {},
  handler: async (ctx) => queryVisibleEntities(ctx, 'Equipment'),
})
