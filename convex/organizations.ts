import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { checkIdempotency } from './lib/idempotency'
import { requireOrgAdmin } from './lib/activeOrg'
import { ErrorCode } from './lib/errorCodes'
import { addressStructuredValidator } from './shared/addressValidator'
import { assertCountryCode } from './lib/i18nValidators'
import { cascadeOrgDelete } from './lib/orgCascade'

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
        await ctx.db.patch(creator._id, { organizationId: orgId })
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

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

export const getById = query({
  args: { id: v.id('organizations') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const updateBusinessMetadata = mutation({
  args: {
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(addressStructuredValidator),
    placeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdmin(ctx)

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.phone !== undefined) patch.phone = args.phone
    if (args.email !== undefined) patch.email = args.email
    if (args.address !== undefined) {
      assertCountryCode(args.address.country, 'address.country')
      patch.address = args.address
    }
    if (args.placeId !== undefined) patch.placeId = args.placeId

    if (Object.keys(patch).length === 1) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'no_fields_to_update' })
    }

    await ctx.db.patch(org._id, patch)
    return org._id
  },
})
