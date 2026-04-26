import { ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  entityProfilesMine,
  entityProfilesByUser,
  entityProfileUpdate,
  entityProfileCreate,
} from './lib/profileHelpers'
import { authorize } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
import { visibleOrgIds } from './lib/destinationScope'
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
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
  },
  handler: async (ctx, args) => {
    const actor = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const rows = await entityProfilesByUser(ctx, actor.user._id, 'Equipment')
    const target = rows[0]
    if (!target) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    return entityProfileUpdate(ctx, target._id, args, 'Equipment', actor)
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const rows = await entityProfilesMine(ctx, 'Equipment')
    return rows[0] ?? null
  },
})

export const visibleToMe = query({
  args: {},
  handler: async (ctx) => {
    const orgIds = await visibleOrgIds(ctx)
    if (orgIds.length === 0) return []
    const results = await Promise.all(
      orgIds.map((orgId) =>
        ctx.db
          .query('equipment')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
          .collect(), // bounded: per-org equipment count, realistic cap ~5
      ),
    )
    return results.flat()
  },
})
