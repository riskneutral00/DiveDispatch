import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { checkIdempotency } from './lib/idempotency'
import { requireOrgAdmin } from './lib/activeOrg'
import { authorize, getAuthUser } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
import { addressStructuredValidator } from './shared/addressValidator'
import { assertCountryCode } from './lib/validators'
import { cascadeOrgDelete, ORG_CHILD_TABLES, SOFT_DELETE_TTL_MS } from './lib/orgCascade'
import { setUserOrganization } from './lib/userOrg'
import { assertDestinationOrgsValid } from './lib/destinationScope'

async function findSeedRebindCandidate(
  ctx: MutationCtx,
  slug: string,
  name: string,
): Promise<Doc<'organizations'> | null> {
  const bySlug = await ctx.db
    .query('organizations')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .unique()
  if (bySlug && bySlug.clerkOrgId === undefined) return bySlug

  const allMatchingName = await ctx.db
    .query('organizations')
    .filter((q) => q.eq(q.field('name'), name))
    .collect() // bounded: organizations table is one-row-per-operator (≤low-thousands in production); name-collision count ≤2 in practice
  for (const candidate of allMatchingName) {
    if (candidate.clerkOrgId === undefined) return candidate
  }
  return null
}

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
      const patch: Record<string, unknown> = {
        name: args.name,
        slug: args.slug,
        updatedAt: now,
      }
      if (existing.deletedAt !== undefined) {
        patch.deletedAt = undefined
      }
      await ctx.db.patch(existing._id, patch)
      orgId = existing._id
    } else {
      const seedRebindCandidate = await findSeedRebindCandidate(ctx, args.slug, args.name)
      if (seedRebindCandidate) {
        await ctx.db.patch(seedRebindCandidate._id, {
          clerkOrgId: args.clerkOrgId,
          name: args.name,
          slug: args.slug,
          updatedAt: now,
        })
        orgId = seedRebindCandidate._id
      } else {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: args.clerkOrgId,
          name: args.name,
          slug: args.slug,
          createdAt: now,
          updatedAt: now,
        })
      }
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

async function captureManifestCounts(
  ctx: MutationCtx,
  orgId: Id<'organizations'>,
): Promise<{
  diveCenters: number
  diveStaff: number
  agents: number
  boats: number
  equipment: number
  compressors: number
  venues: number
  userRoles: number
  users: number
}> {
  const counts = {
    diveCenters: 0,
    diveStaff: 0,
    agents: 0,
    boats: 0,
    equipment: 0,
    compressors: 0,
    venues: 0,
    userRoles: 0,
    users: 0,
  }
  for (const table of ORG_CHILD_TABLES) {
    const rows = await ctx.db
      .query(table)
      .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
      .collect() // bounded: per-org child counts ≤low-thousands
    counts[table] = rows.length
  }
  const userRoles = await ctx.db
    .query('userRoles')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
    .collect() // bounded: per-org members × roles ≤low-thousands
  counts.userRoles = userRoles.length
  const users = await ctx.db
    .query('users')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
    .collect() // bounded: per-org user count ≤low-thousands
  counts.users = users.length
  return counts
}

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
    if (org.deletedAt !== undefined) return

    const manifestCounts = await captureManifestCounts(ctx, org._id)
    const now = Date.now()

    await ctx.db.patch(org._id, {
      deletedAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('webhookAuditLog', {
      eventType: 'org_cascade_initiated',
      orgId: org._id,
      orgName: org.name,
      orgSlug: org.slug,
      manifestCounts,
      at: now,
    })
  },
})

export const purgeSoftDeletedOrgs = internalMutation({
  args: {},
  returns: v.object({ purged: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - SOFT_DELETE_TTL_MS
    const candidates = await ctx.db
      .query('organizations')
      .filter((q) =>
        q.and(
          q.neq(q.field('deletedAt'), undefined),
          q.lt(q.field('deletedAt'), cutoff),
        ),
      )
      .collect() // bounded: organizations table is one-row-per-operator (≤low-thousands)

    let purged = 0
    for (const org of candidates) {
      await cascadeOrgDelete(ctx, org._id) // batch-exempt: cascade must complete per-org before final delete; cron rarely sees more than a few candidates per run
      const stillExists = await ctx.db.get(org._id) // batch-exempt: idempotency check; org row delete depends on the result
      if (stillExists) {
        await ctx.db.delete(org._id) // batch-exempt: paired with the cascade above; cannot batch since cascade runs first
      }
      purged++
    }
    return { purged }
  },
})

export const publicByClerkOrgId = query({
  args: { clerkOrgId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('organizations'),
      name: v.string(),
      slug: v.string(),
      isAreaOrg: v.boolean(),
    }),
  ),
  handler: async (ctx, { clerkOrgId }) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!org) return null
    if (org.deletedAt !== undefined) return null
    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      isAreaOrg: org.isAreaOrg ?? false,
    }
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
    if (org.deletedAt !== undefined) return null
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
