import { mutation } from '../_generated/server'
import { v, ConvexError } from 'convex/values'
import { ErrorCode } from '../lib/errorCodes'
import { requireDevEnvironment } from '../lib/devGuard'
import { addressStructuredValidator } from '../shared/addressValidator'
import { venueKindValidator } from '../shared/venueTypes'
import { venueFeatureValidator } from '../shared/venueFeatures'
import { assertVenueRange, assertVenueKindConsistent } from '../lib/venueValidators'
import { assertPhoneE164, assertCountryCode } from '../lib/i18nValidators'

export const run = mutation({
  args: {
    orgSlug: v.string(),
    slug: v.string(),
    name: v.optional(v.string()),
    kind: v.optional(venueKindValidator),
    address: v.optional(addressStructuredValidator),
    placeId: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    features: v.optional(v.array(venueFeatureValidator)),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
    confinedCapable: v.optional(v.boolean()),
    verified: v.optional(v.boolean()),
    isAllowed: v.optional(v.array(v.string())),
    notAllowed: v.optional(v.array(v.string())),
  },
  returns: v.object({
    venueId: v.id('venues'),
    action: v.union(v.literal('created'), v.literal('updated')),
    orgId: v.id('organizations'),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    requireDevEnvironment()

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', args.orgSlug))
      .unique()
    if (!org) {
      throw new ConvexError({
        code: ErrorCode.NOT_FOUND,
        reason: `No organization with slug '${args.orgSlug}'`,
      })
    }

    if (args.phone !== undefined && args.phone !== '') {
      assertPhoneE164(args.phone, 'phone')
    }
    if (args.address?.country) {
      assertCountryCode(args.address.country, 'address.country')
    }

    const existing = await ctx.db
      .query('venues')
      .withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
      .filter((q) => q.eq(q.field('slug'), args.slug))
      .unique()

    if (existing) {
      const effectiveKind = args.kind ?? existing.kind
      if (args.confinedCapable !== undefined) {
        assertVenueKindConsistent(effectiveKind, args.confinedCapable)
      }
      assertVenueRange(effectiveKind, args.maxDepth, args.maxCapacity)

      const patch: Record<string, unknown> = {}
      if (args.name !== undefined) patch.name = args.name
      if (args.kind !== undefined) patch.kind = args.kind
      if (args.address !== undefined) patch.address = args.address
      if (args.placeId !== undefined) patch.placeId = args.placeId
      if (args.lat !== undefined) patch.lat = args.lat
      if (args.lng !== undefined) patch.lng = args.lng
      if (args.email !== undefined) patch.email = args.email
      if (args.phone !== undefined) patch.phone = args.phone
      if (args.features !== undefined) patch.features = args.features
      if (args.maxDepth !== undefined) patch.maxDepth = args.maxDepth
      if (args.maxCapacity !== undefined) patch.maxCapacity = args.maxCapacity
      if (args.confinedCapable !== undefined) {
        patch.confinedCapable = effectiveKind === 'pool' ? true : args.confinedCapable
      }
      if (args.verified !== undefined) patch.verified = args.verified
      if (args.isAllowed !== undefined) patch.isAllowed = args.isAllowed
      if (args.notAllowed !== undefined) patch.notAllowed = args.notAllowed

      await ctx.db.patch(existing._id, patch)

      return {
        venueId: existing._id,
        action: 'updated' as const,
        orgId: org._id,
        slug: args.slug,
      }
    }

    if (
      args.name === undefined ||
      args.kind === undefined ||
      args.address === undefined ||
      args.lat === undefined ||
      args.lng === undefined
    ) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'create_requires_name_kind_address_lat_lng',
      })
    }

    assertVenueKindConsistent(args.kind, args.confinedCapable)
    assertVenueRange(args.kind, args.maxDepth, args.maxCapacity)

    const venueId = await ctx.db.insert('venues', {
      organizationId: org._id,
      slug: args.slug,
      name: args.name,
      kind: args.kind,
      features: args.features ?? [],
      address: args.address,
      placeId: args.placeId,
      lat: args.lat,
      lng: args.lng,
      email: args.email ?? '',
      phone: args.phone ?? '',
      verified: args.verified ?? false,
      isAllowed: args.isAllowed,
      notAllowed: args.notAllowed,
      confinedCapable: args.kind === 'pool' ? true : args.confinedCapable,
      maxDepth: args.maxDepth,
      maxCapacity: args.maxCapacity,
    })

    return {
      venueId,
      action: 'created' as const,
      orgId: org._id,
      slug: args.slug,
    }
  },
})
