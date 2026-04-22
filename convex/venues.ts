import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx } from './_generated/server'
import { authorize, assertOrgOwnership } from './lib/auth'
import { getActiveOrg, tryGetActiveOrg } from './lib/activeOrg'
import { checkHasRole } from './userRoles'
import { ErrorCode } from './lib/errorCodes'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD } from './lib/validators'
import {
  venueSubtypeValidator,
  type VenueSubtype,
} from './shared/venueTypes'
import { assertCapabilitiesPresentForSubtype, assertVenueRange, assertVenueSubtypeConsistent } from './lib/venueValidators'
import { assertPhoneE164, assertCountryCode } from './lib/i18nValidators'
import { cleanupInventoryForOwner } from './lib/inventoryCleanup'
import { isActiveReservation } from './bookings/_shared'
import { setRoleProfileComplete } from './lib/setRoleProfileComplete'

async function mintUniqueVenueSlug(ctx: MutationCtx, baseName: string): Promise<string> {
  const base = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'venue'
  let candidate = base
  let suffix = 1
  // bounded: collision retries rare in practice; worst-case scan tiny
  while (true) {
    const existing = await ctx.db
      .query('venues')
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
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    subtype: venueSubtypeValidator,
    confinedCapable: v.optional(v.boolean()),
    hasCompressor: v.boolean(),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const subtype = args.subtype
    const confinedCapable = args.confinedCapable
    assertVenueSubtypeConsistent(subtype, confinedCapable)
    assertVenueRange(subtype, args.maxDepth, args.maxCapacity)
    assertCapabilitiesPresentForSubtype(subtype, args.maxDepth, args.maxCapacity)

    if (args.phone !== undefined && args.phone !== '') {
      assertPhoneE164(args.phone, 'phone')
    }
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const hasVenueRole = await checkHasRole(ctx, user._id, 'Venue')
    if (!hasVenueRole) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const { org: activeOrg } = await getActiveOrg(ctx)

    const slug = await mintUniqueVenueSlug(ctx, args.name)

    const { subtype: _ignoredSubtype, confinedCapable: _ignoredConfined, ...rest } = args

    const venueId = await ctx.db.insert('venues', {
      ...rest,
      slug,
      subtype,
      confinedCapable: subtype === 'shore' || subtype === 'other' ? confinedCapable : undefined,
      organizationId: activeOrg._id,
      verified: false,
    })

    const totalUnits = args.maxCapacity && args.maxCapacity > 0 ? args.maxCapacity : 999999
    await ctx.db.insert('inventoryUnits', {
      resourceType: 'Venue',
      resourceId: slug,
      displayName: args.name,
      capacityModel: 'Pooled',
      totalUnits,
      ownerId: slug,
      ownerType: 'Venue',
    })

    await setRoleProfileComplete(ctx, user._id, 'Venue')

    return venueId
  },
})

export const update = mutation({
  args: {
    venueId: v.id('venues'),
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...BUSINESS_NAME_UPDATE_FIELD,
    ...ACCESS_CONTROL_FIELDS,
    subtype: v.optional(venueSubtypeValidator),
    confinedCapable: v.optional(v.boolean()),
    hasCompressor: v.optional(v.boolean()),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const venue = await ctx.db.get(args.venueId)
    if (!venue) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { org: activeOrg } = await getActiveOrg(ctx)
    assertOrgOwnership(venue, activeOrg)

    if (args.phone !== undefined && args.phone !== '') {
      assertPhoneE164(args.phone, 'phone')
    }
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const { venueId: _vid, subtype, confinedCapable, ...rest } = args
    const patch: Record<string, unknown> = { ...rest }

    const effectiveSubtype: VenueSubtype = subtype ?? (venue.subtype as VenueSubtype)
    if (subtype !== undefined) {
      patch.subtype = subtype
    }
    if (confinedCapable !== undefined) {
      assertVenueSubtypeConsistent(effectiveSubtype, confinedCapable)
      patch.confinedCapable =
        effectiveSubtype === 'shore' || effectiveSubtype === 'other' ? confinedCapable : undefined
    }

    assertVenueRange(effectiveSubtype, args.maxDepth, args.maxCapacity)

    const effectiveMaxDepth = args.maxDepth ?? (venue.maxDepth as number | undefined)
    const effectiveMaxCapacity = args.maxCapacity ?? (venue.maxCapacity as number | undefined)
    assertCapabilitiesPresentForSubtype(effectiveSubtype, effectiveMaxDepth, effectiveMaxCapacity)

    await ctx.db.patch(args.venueId, patch)

    if (args.maxCapacity !== undefined) {
      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
        )
        .unique()
      if (unit) {
        const totalUnits = args.maxCapacity > 0 ? args.maxCapacity : 999999
        await ctx.db.patch(unit._id, { totalUnits })
      }
    }

    if (args.name !== undefined && args.name !== venue.name) {
      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
        )
        .unique()
      if (unit) {
        await ctx.db.patch(unit._id, { displayName: args.name })
      }
    }

    await setRoleProfileComplete(ctx, user._id, 'Venue')
  },
})

export const remove = mutation({
  args: { venueId: v.id('venues') },
  handler: async (ctx, { venueId }) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const venue = await ctx.db.get(venueId)
    if (!venue) return

    const { org: activeOrg } = await getActiveOrg(ctx)
    assertOrgOwnership(venue, activeOrg)

    const units = await ctx.db
      .query('inventoryUnits')
      .withIndex('by_ownerId_ownerType', (q) =>
        q.eq('ownerId', venue.slug).eq('ownerType', 'Venue'),
      )
      .collect() // bounded: per-venue inventory unit count, typically 1
    for (const unit of units) {
      const activeReservations = await ctx.db
        .query('reservations')
        .withIndex('by_inventoryUnitId_status', (q) => q.eq('inventoryUnitId', unit._id))
        .collect() // bounded: reservations per unit, bounded by unit lifetime
      if (activeReservations.some(isActiveReservation)) {
        throw new ConvexError({ code: ErrorCode.CONFLICT, reason: 'active_reservations' })
      }
    }

    await cleanupInventoryForOwner(ctx, venue.slug, 'Venue')
    await ctx.db.delete(venueId)

    await setRoleProfileComplete(ctx, user._id, 'Venue')
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const activeOrg = await tryGetActiveOrg(ctx)
    if (!activeOrg) return []
    return await ctx.db
      .query('venues')
      .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrg._id))
      .collect() // bounded: per-org venue count, realistic cap ~20
  },
})

export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query('venues')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
  },
})
