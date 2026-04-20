import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authorize } from './lib/auth'
import { getActiveOrg } from './lib/activeOrg'
import { profileByUser, profileMine } from './lib/profileHelpers'
import { checkHasRole } from './userRoles'
import { ErrorCode } from './lib/errorCodes'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'
import {
  venueCategoryValidator,
  diveSiteTypeValidator,
  type VenueCategory,
  type DiveSiteType,
} from './shared/venueTypes'

type VenueWriteInput = {
  venueCategory?: VenueCategory
  diveSiteTypes?: DiveSiteType[]
  confinedCapable?: boolean
  maxCapacity?: number
}

type ResolvedVenueFields = {
  venueCategory: VenueCategory
  diveSiteTypes: DiveSiteType[] | undefined
  confinedCapable: boolean | undefined
}

function resolveVenueFields(input: VenueWriteInput): ResolvedVenueFields {
  if (!input.venueCategory) {
    throw new ConvexError({ code: ErrorCode.INVALID_INPUT, field: 'venueCategory' })
  }

  if (input.venueCategory === 'pool') {
    if (input.diveSiteTypes && input.diveSiteTypes.length > 0) {
      throw new ConvexError({ code: ErrorCode.INVALID_INPUT, field: 'diveSiteTypes' })
    }
    if (input.confinedCapable !== undefined) {
      throw new ConvexError({ code: ErrorCode.INVALID_INPUT, field: 'confinedCapable' })
    }
    return {
      venueCategory: 'pool',
      diveSiteTypes: undefined,
      confinedCapable: undefined,
    }
  }

  if (!input.diveSiteTypes || input.diveSiteTypes.length === 0) {
    throw new ConvexError({ code: ErrorCode.INVALID_INPUT, field: 'diveSiteTypes' })
  }

  return {
    venueCategory: 'diveSite',
    diveSiteTypes: input.diveSiteTypes,
    confinedCapable: input.confinedCapable,
  }
}

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    venueCategory: venueCategoryValidator,
    diveSiteTypes: v.optional(v.array(diveSiteTypeValidator)),
    confinedCapable: v.optional(v.boolean()),
    hasCompressor: v.boolean(),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const resolved = resolveVenueFields({
      venueCategory: args.venueCategory,
      diveSiteTypes: args.diveSiteTypes,
      confinedCapable: args.confinedCapable,
      maxCapacity: args.maxCapacity,
    })

    if (resolved.venueCategory === 'pool' && !(await checkHasRole(ctx, user._id, 'Pool'))) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }
    if (resolved.venueCategory === 'diveSite' && !(await checkHasRole(ctx, user._id, 'DiveSite'))) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const { org: activeOrg } = await getActiveOrg(ctx)

    const existing = await ctx.db
      .query('venues')
      .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
      .unique()
    if (existing) return existing._id

    const {
      venueCategory: _ignoredCategory,
      diveSiteTypes: _ignoredTypes,
      confinedCapable: _ignoredConfined,
      ...rest
    } = args

    const venueId = await ctx.db.insert('venues', {
      ...rest,
      placeName: rest.placeName ?? '',
      country: rest.country ?? '',
      venueCategory: resolved.venueCategory,
      diveSiteTypes: resolved.diveSiteTypes,
      confinedCapable: resolved.confinedCapable,
      organizationId: activeOrg._id,
      verified: false,
    })

    const totalUnits = args.maxCapacity && args.maxCapacity > 0 ? args.maxCapacity : 999999
    const resourceType = resolved.venueCategory === 'diveSite' ? 'DiveSite' : 'Pool'
    await ctx.db.insert('inventoryUnits', {
      resourceType,
      resourceId: user.slug,
      displayName: args.name,
      capacityModel: 'Pooled',
      totalUnits,
      ownerId: user.slug,
      ownerType: resourceType,
    })

    return venueId
  },
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    venueCategory: v.optional(venueCategoryValidator),
    diveSiteTypes: v.optional(v.array(diveSiteTypeValidator)),
    confinedCapable: v.optional(v.boolean()),
    hasCompressor: v.optional(v.boolean()),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const profile = await profileByUser(ctx, user._id, 'venues')
    if (!profile) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { venueCategory, diveSiteTypes, confinedCapable, ...rest } = args
    const patch: Record<string, unknown> = { ...rest }

    const hasCategoryInput =
      venueCategory !== undefined ||
      diveSiteTypes !== undefined ||
      confinedCapable !== undefined

    if (hasCategoryInput) {
      const existingCategory = profile.venueCategory as VenueCategory | undefined
      if (!existingCategory) {
        throw new ConvexError({ code: ErrorCode.INVALID_STATE, field: 'venueCategory' })
      }
      if (venueCategory !== undefined && venueCategory !== existingCategory) {
        throw new ConvexError({ code: ErrorCode.INVALID_INPUT, field: 'venueCategory' })
      }

      const resolved = resolveVenueFields({
        venueCategory: existingCategory,
        diveSiteTypes: diveSiteTypes ?? (profile.diveSiteTypes as DiveSiteType[] | undefined),
        confinedCapable: confinedCapable ?? profile.confinedCapable,
      })

      patch.venueCategory = resolved.venueCategory
      patch.diveSiteTypes = resolved.diveSiteTypes
      patch.confinedCapable = resolved.confinedCapable
    }

    await ctx.db.patch(profile._id, patch)

    if (args.maxCapacity !== undefined) {
      const existingCategory = profile.venueCategory as VenueCategory | undefined
      const resourceType = existingCategory === 'pool' ? 'Pool' : 'DiveSite'
      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', user.slug).eq('ownerType', resourceType),
        )
        .unique()
      if (unit) {
        const totalUnits = args.maxCapacity > 0 ? args.maxCapacity : 999999
        await ctx.db.patch(unit._id, { totalUnits })
      }
    }
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    return await profileMine(ctx, 'venues')
  },
})
