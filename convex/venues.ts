import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx } from './_generated/server'
import { authorize, assertOrgOwnership, getAuthUser } from './lib/auth'
import { getActiveOrg, tryGetActiveOrg } from './lib/activeOrg'
import { entityProfilesMine, queryVisibleEntities } from './lib/profileHelpers'
import { evaluateRowCompleteness } from './lib/completeness/perRow'
import type { Doc } from './_generated/dataModel'
import { checkHasRole } from './userRoles'
import { ErrorCode } from './lib/errorCodes'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS, BUSINESS_NAME_CREATE_FIELD, BUSINESS_NAME_UPDATE_FIELD, assertVenueRange, assertVenueKindConsistent, assertPhoneE164, assertCountryCode } from './lib/validators'
import {
  venueKindValidator,
  type VenueKind,
} from './shared/venueTypes'
import { venueFeatureValidator } from './shared/venueFeatures'
import { gasMixValidator } from './shared/gasMixes'
import { validateNitroxRange } from './lib/gasMixValidation'

const GAS_MIX_FIELDS = {
  gasMixes: v.optional(v.array(gasMixValidator)),
  nitroxMin: v.optional(v.number()),
  nitroxMax: v.optional(v.number()),
}
import { cleanupInventoryForOwner } from './lib/inventoryCleanup'
import { isActiveReservation } from './bookings/_shared'
import { setRoleProfileComplete } from './lib/setRoleProfileComplete'
import { safePatchIfExists } from './lib/safeDbOps'

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
    kind: venueKindValidator,
    features: v.array(venueFeatureValidator),
    confinedCapable: v.optional(v.boolean()),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
    ...GAS_MIX_FIELDS,
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })

    const kind = args.kind
    const confinedCapable = args.confinedCapable
    assertVenueKindConsistent(kind, confinedCapable)
    assertVenueRange(kind, args.maxDepth, args.maxCapacity)
    validateNitroxRange(args)

    if (!args.email || args.email.trim() === '') {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'missing_email' })
    }
    if (!args.phone || args.phone.trim() === '') {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'missing_phone' })
    }
    assertPhoneE164(args.phone, 'phone')
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const hasVenueRole = await checkHasRole(ctx, user._id, 'Venue')
    if (!hasVenueRole) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    const { org: activeOrg } = await getActiveOrg(ctx)

    const slug = await mintUniqueVenueSlug(ctx, args.name)

    const { kind: _ignoredKind, confinedCapable: _ignoredConfined, ...rest } = args

    const venueId = await ctx.db.insert('venues', {
      ...rest,
      slug,
      kind,
      confinedCapable: kind === 'pool' ? true : confinedCapable,
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
    kind: v.optional(venueKindValidator),
    features: v.optional(v.array(venueFeatureValidator)),
    confinedCapable: v.optional(v.boolean()),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
    ...GAS_MIX_FIELDS,
  },
  handler: async (ctx, args) => {
    const { user } = await authorize(ctx, null, 'resource:manage', { type: 'resource' })
    validateNitroxRange(args)

    const venue = await ctx.db.get(args.venueId)
    if (!venue) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { org: activeOrg } = await getActiveOrg(ctx)
    assertOrgOwnership(venue, activeOrg)

    if (args.kind !== undefined && args.kind !== venue.kind) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'kind_immutable',
      })
    }

    if (args.email !== undefined && args.email.trim() === '') {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'missing_email' })
    }
    if (args.phone !== undefined) {
      if (args.phone.trim() === '') {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'missing_phone' })
      }
      assertPhoneE164(args.phone, 'phone')
    }
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const { venueId: _vid, kind, confinedCapable, ...rest } = args
    const patch: Record<string, unknown> = { ...rest }

    const effectiveKind: VenueKind = kind ?? (venue.kind as VenueKind)
    if (kind !== undefined) {
      patch.kind = kind
    }
    if (confinedCapable !== undefined) {
      assertVenueKindConsistent(effectiveKind, confinedCapable)
      patch.confinedCapable = effectiveKind === 'pool' ? true : confinedCapable
    }

    assertVenueRange(effectiveKind, args.maxDepth, args.maxCapacity)

    if (args.maxDepth !== undefined && args.maxDepth <= 0) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'missing_maxDepth' })
    }
    if (effectiveKind === 'pool' && args.maxCapacity !== undefined && args.maxCapacity <= 0) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'missing_maxCapacity' })
    }

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
        await safePatchIfExists(ctx, unit._id, { totalUnits })
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
        await safePatchIfExists(ctx, unit._id, { displayName: args.name })
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
  handler: async (ctx): Promise<Array<Doc<'venues'> & { incomplete: string[] }>> => {
    const venues = await entityProfilesMine(ctx, 'Venue')
    if (venues.length === 0) return []
    const user = await getAuthUser(ctx)
    if (!user) return venues.map((v) => ({ ...v, incomplete: [] }))
    const activeOrg = await tryGetActiveOrg(ctx)
    const activeOrgId = activeOrg?._id ?? null
    return Promise.all(
      venues.map(async (venue) => {
        const { incomplete } = await evaluateRowCompleteness(
          ctx,
          user,
          'Venue',
          venue as unknown as Record<string, unknown>,
          activeOrgId,
        )
        return { ...venue, incomplete }
      }),
    )
  },
})

export const visibleToMe = query({
  args: {},
  handler: async (ctx) => queryVisibleEntities(ctx, 'Venue'),
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
