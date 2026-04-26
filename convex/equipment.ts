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
    const { user } = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const row = await ctx.db.get(entityId)
    if (!row) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    const { org: activeOrg } = await getActiveOrg(ctx)
    assertOrgOwnership(row, activeOrg)
    await ctx.db.patch(entityId, { archivedAt: Date.now() })
    await setRoleProfileComplete(ctx, user._id, 'Equipment')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => entityProfilesMine(ctx, 'Equipment'),
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
    return results.flat().filter((row) => row.archivedAt === undefined)
  },
})
