import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { authorize, assertOrgOwnership } from './lib/auth'
import { getActiveOrg, tryGetActiveOrg } from './lib/activeOrg'
import { visibleOrgIds } from './lib/destinationScope'
import { checkHasRole } from './userRoles'
import { ErrorCode } from './lib/errorCodes'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'
import { gasMixValidator } from './shared/gasMixes'
import { compressorLocationValidator } from './shared/compressorTypes'
import { assertPhoneE164, assertCountryCode } from './lib/i18nValidators'
import { setRoleProfileComplete } from './lib/setRoleProfileComplete'
import { cleanupInventoryForOwner } from './lib/inventoryCleanup'
import { isActiveReservation } from './bookings/_shared'
import { batchDelete } from './lib/batch'

function validateNitroxRange(args: { nitroxMin?: number; nitroxMax?: number }) {
  if (args.nitroxMin !== undefined || args.nitroxMax !== undefined) {
    const min = args.nitroxMin ?? 21
    const max = args.nitroxMax ?? 40
    if (min < 21 || max > 40 || min > max) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'nitroxMin must be 21–40, nitroxMax must be 21–40, min ≤ max' })
    }
  }
}

async function assertLocationRefsConsistent(
  ctx: MutationCtx,
  args: { location: 'fixed' | 'boat' | 'venue'; boatId?: Id<'boats'>; venueId?: Id<'venues'> },
  activeOrg: { _id: Id<'organizations'> },
) {
  if (args.location === 'fixed') {
    if (args.boatId || args.venueId) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'location=fixed must not reference boatId or venueId' })
    }
    return
  }
  if (args.location === 'boat') {
    if (!args.boatId || args.venueId) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'location=boat requires boatId and must not set venueId' })
    }
    const boat = await ctx.db.get(args.boatId)
    if (!boat) throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'boatId' })
    assertOrgOwnership(boat, activeOrg)
    return
  }
  if (args.location === 'venue') {
    if (!args.venueId || args.boatId) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'location=venue requires venueId and must not set boatId' })
    }
    const venue = await ctx.db.get(args.venueId)
    if (!venue) throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'venueId' })
    assertOrgOwnership(venue, activeOrg)
    return
  }
}

async function mintUniqueCompressorSlug(ctx: MutationCtx, baseName: string): Promise<string> {
  const base = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'compressor'
  let candidate = base
  let suffix = 1
  while (true) {
    const existing = await ctx.db
      .query('compressors')
      .withIndex('by_slug', (q) => q.eq('slug', candidate))
      .unique()
    if (!existing) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    location: compressorLocationValidator,
    boatId: v.optional(v.id('boats')),
    venueId: v.optional(v.id('venues')),
    gasMixes: v.optional(v.array(gasMixValidator)),
    nitroxMin: v.optional(v.number()),
    nitroxMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    validateNitroxRange(args)

    if (args.phone !== undefined && args.phone !== '') {
      assertPhoneE164(args.phone, 'phone')
    }
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const hasRole = await checkHasRole(ctx, user._id, 'Compressor')
    if (!hasRole) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const { org: activeOrg } = await getActiveOrg(ctx)

    await assertLocationRefsConsistent(ctx, {
      location: args.location,
      boatId: args.boatId,
      venueId: args.venueId,
    }, activeOrg)

    const slug = await mintUniqueCompressorSlug(ctx, args.name)

    const id = await ctx.db.insert('compressors', {
      ...args,
      slug,
      organizationId: activeOrg._id,
      verified: false,
    })

    await setRoleProfileComplete(ctx, user._id, 'Compressor')

    return id
  },
})

export const update = mutation({
  args: {
    compressorId: v.id('compressors'),
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    location: v.optional(compressorLocationValidator),
    boatId: v.optional(v.id('boats')),
    venueId: v.optional(v.id('venues')),
    gasMixes: v.optional(v.array(gasMixValidator)),
    nitroxMin: v.optional(v.number()),
    nitroxMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const compressor = await ctx.db.get(args.compressorId)
    if (!compressor) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { org: activeOrg } = await getActiveOrg(ctx)
    assertOrgOwnership(compressor, activeOrg)

    const nextLocation = args.location ?? compressor.location
    let nextBoatId = args.boatId !== undefined ? args.boatId : compressor.boatId
    let nextVenueId = args.venueId !== undefined ? args.venueId : compressor.venueId
    if (nextLocation === 'fixed') {
      nextBoatId = undefined
      nextVenueId = undefined
    } else if (nextLocation === 'boat') {
      nextVenueId = undefined
    } else if (nextLocation === 'venue') {
      nextBoatId = undefined
    }
    await assertLocationRefsConsistent(ctx, {
      location: nextLocation,
      boatId: nextBoatId,
      venueId: nextVenueId,
    }, activeOrg)

    validateNitroxRange(args)

    if (args.phone !== undefined && args.phone !== '') {
      assertPhoneE164(args.phone, 'phone')
    }
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const { compressorId: _cid, ...rest } = args
    const patch: Record<string, unknown> = { ...rest }
    patch.boatId = nextBoatId
    patch.venueId = nextVenueId
    await ctx.db.patch(args.compressorId, patch)

    await setRoleProfileComplete(ctx, user._id, 'Compressor')
  },
})

export const remove = mutation({
  args: { compressorId: v.id('compressors') },
  handler: async (ctx, { compressorId }) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const compressor = await ctx.db.get(compressorId)
    if (!compressor) return

    const { org: activeOrg } = await getActiveOrg(ctx)
    assertOrgOwnership(compressor, activeOrg)

    const resourceRows = await ctx.db
      .query('bookingResources')
      .withIndex('by_resourceType_resourceId', (q) =>
        q.eq('resourceType', 'Compressor').eq('resourceId', compressor.slug),
      )
      .collect() // bounded: per-compressor bookingResources rows
    const reservationSets = await Promise.all(
      resourceRows.map((row) =>
        ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', row.bookingId))
          .collect(), // bounded: per-booking reservations, bounded by booking scope
      ),
    )
    if (reservationSets.flat().some(isActiveReservation)) {
      throw new ConvexError({ code: ErrorCode.CONFLICT, reason: 'active_reservations' })
    }
    await batchDelete(ctx, resourceRows)

    await cleanupInventoryForOwner(ctx, compressor.slug, 'Compressor')
    await ctx.db.delete(compressorId)

    await setRoleProfileComplete(ctx, user._id, 'Compressor')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const activeOrg = await tryGetActiveOrg(ctx)
    if (!activeOrg) return []
    return await ctx.db
      .query('compressors')
      .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
      .collect() // bounded: per-org compressor count, realistic cap ~10
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
          .query('compressors')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
          .collect(), // bounded: per-org compressor count, realistic cap ~10
      ),
    )
    return results.flat()
  },
})

