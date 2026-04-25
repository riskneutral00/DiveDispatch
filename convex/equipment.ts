import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { visibleOrgIds } from './lib/destinationScope'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
  },
  handler: async (ctx, args) =>
    profileCreate(ctx, args, 'equipment', 'Equipment', { verified: false }),
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
  },
  handler: async (ctx, args) => profileUpdate(ctx, args, 'equipment', 'Equipment'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'equipment'),
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
