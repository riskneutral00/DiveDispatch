import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authorize, assertOrgOwnership } from './lib/auth'
import { getActiveOrg } from './lib/activeOrg'
import { entityProfilesMine, queryVisibleEntities } from './lib/profileHelpers'
import { checkHasRole } from './userRoles'
import { ErrorCode } from './lib/errorCodes'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD, assertPhoneE164, assertCountryCode } from './lib/validators'
import { gasMixValidator } from './shared/gasMixes'
import { setRoleProfileComplete } from './lib/setRoleProfileComplete'
import { cleanupInventoryForOwner } from './lib/inventoryCleanup'
import { isActiveReservation } from './bookings/_shared'
import { batchDelete } from './lib/batch'
import { mintUniqueEntitySlug } from './lib/entitySlug'
import { validateNitroxRange } from './lib/gasMixValidation'

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...BUSINESS_NAME_CREATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
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

    const slug = await mintUniqueEntitySlug(ctx, 'compressors', args.name)

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

    validateNitroxRange(args)

    if (args.phone !== undefined && args.phone !== '') {
      assertPhoneE164(args.phone, 'phone')
    }
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const { compressorId: _cid, ...rest } = args
    await ctx.db.patch(args.compressorId, rest)

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
  handler: async (ctx) => entityProfilesMine(ctx, 'Compressor'),
})

export const visibleToMe = query({
  args: {},
  handler: async (ctx) => queryVisibleEntities(ctx, 'Compressor'),
})

