import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { checkIdempotency } from './lib/idempotency'
import { requireOrgAdmin } from './lib/activeOrg'
import { authorize, getAuthUser } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
import { addressStructuredValidator } from './shared/addressValidator'
import { assertCountryCode } from './lib/i18nValidators'
import { cascadeOrgDelete } from './lib/orgCascade'
import { setUserOrganization } from './lib/userOrg'
import { assertDestinationOrgsValid } from './lib/destinationScope'

export const upsertFromWebhook = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    svixId: v.optional(v.string()),
    creatorTokenIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.svixId) {
      const isDuplicate = await checkIdempotency(ctx, args.svixId, 'clerk_org_upsert')
      if (isDuplicate) {
        const existing = await ctx.db
          .query('organizations')
          .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', args.clerkOrgId))
          .unique()
        if (existing) return existing._id
      }
    }

    const existing = await ctx.db
      .query('organizations')
      .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()

    const now = Date.now()

    let orgId: Id<'organizations'>
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        slug: args.slug,
        updatedAt: now,
      })
      orgId = existing._id
    } else {
      orgId = await ctx.db.insert('organizations', {
        clerkOrgId: args.clerkOrgId,
        name: args.name,
        slug: args.slug,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (args.creatorTokenIdentifier) {
      const creator = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', args.creatorTokenIdentifier!))
        .unique()
      if (creator) {
        await setUserOrganization(ctx, creator._id, orgId)
      }
    }

    return orgId
  },
})

export const deleteFromWebhook = internalMutation({
  args: {
    clerkOrgId: v.string(),
    svixId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.svixId) {
      const isDuplicate = await checkIdempotency(ctx, args.svixId, 'clerk_org_delete')
      if (isDuplicate) return
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()
    if (!org) return

    await cascadeOrgDelete(ctx, org._id)
    await ctx.db.delete(org._id)
  },
})

export const publicBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('organizations'),
      name: v.string(),
      slug: v.string(),
      isAreaOrg: v.boolean(),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (!org) return null
    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      isAreaOrg: org.isAreaOrg ?? false,
    }
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    await authorize(ctx, null, 'resource:read', { type: 'resource' })
    return await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

export const updateBusinessMetadata = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(addressStructuredValidator),
    placeId: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    destinationIds: v.optional(v.array(v.id('organizations'))),
  },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdmin(ctx)

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) patch.name = args.name
    if (args.phone !== undefined) patch.phone = args.phone
    if (args.email !== undefined) patch.email = args.email
    if (args.address !== undefined) {
      assertCountryCode(args.address.country, 'address.country')
      patch.address = args.address
    }
    if (args.placeId !== undefined) patch.placeId = args.placeId
    if (args.lat !== undefined) patch.lat = args.lat
    if (args.lng !== undefined) patch.lng = args.lng
    if (args.destinationIds !== undefined) {
      await assertDestinationOrgsValid(ctx, args.destinationIds)
      patch.destinationIds = args.destinationIds
    }

    if (Object.keys(patch).length === 1) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'no_fields_to_update' })
    }

    await ctx.db.patch(org._id, patch)
    return org._id
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user?.organizationId) return null
    return await ctx.db.get(user.organizationId)
  },
})
