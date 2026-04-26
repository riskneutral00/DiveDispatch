import { mutation } from '../_generated/server'
import { v, ConvexError } from 'convex/values'
import { ErrorCode } from '../lib/errorCodes'
import { requireDevEnvironment } from '../lib/devGuard'
import { ORG_CHILD_TABLES } from '../lib/orgCascade'

export const run = mutation({
  args: {
    fromClerkOrgId: v.string(),
    toClerkOrgId: v.string(),
  },
  returns: v.object({
    keptOrgId: v.id('organizations'),
    deletedOrgId: v.id('organizations'),
    keptSlug: v.string(),
    newClerkOrgId: v.string(),
  }),
  handler: async (ctx, args) => {
    requireDevEnvironment()

    if (args.fromClerkOrgId === args.toClerkOrgId) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'fromClerkOrgId and toClerkOrgId must differ',
      })
    }

    const fromOrg = await ctx.db
      .query('organizations')
      .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', args.fromClerkOrgId))
      .unique()
    if (!fromOrg) {
      throw new ConvexError({
        code: ErrorCode.NOT_FOUND,
        reason: `No organization with clerkOrgId '${args.fromClerkOrgId}'`,
      })
    }

    const toOrg = await ctx.db
      .query('organizations')
      .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', args.toClerkOrgId))
      .unique()
    if (!toOrg) {
      throw new ConvexError({
        code: ErrorCode.NOT_FOUND,
        reason: `No organization with clerkOrgId '${args.toClerkOrgId}'`,
      })
    }

    for (const table of ORG_CHILD_TABLES) {
      const child = await ctx.db
        .query(table)
        .withIndex('by_organizationId', (q) => q.eq('organizationId', toOrg._id))
        .first()
      if (child) {
        throw new ConvexError({
          code: ErrorCode.VALIDATION,
          reason: `Refusing rebind: target org has ${table} rows. Cannot safely delete a non-empty org.`,
        })
      }
    }

    const targetUserRoles = await ctx.db
      .query('userRoles')
      .withIndex('by_organizationId', (q) => q.eq('organizationId', toOrg._id))
      .first()
    if (targetUserRoles) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'Refusing rebind: target org has userRoles rows.',
      })
    }

    const targetUsers = await ctx.db
      .query('users')
      .withIndex('by_organizationId', (q) => q.eq('organizationId', toOrg._id))
      .first()
    if (targetUsers) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'Refusing rebind: target org has users bound to it.',
      })
    }

    // bounded: dev-only admin tool; org count remains O(stakeholders), low hundreds
    const allOrgs = await ctx.db.query('organizations').collect()
    const referencingOrg = allOrgs.find((o) =>
      (o.destinationIds ?? []).some((id) => id === toOrg._id),
    )
    if (referencingOrg) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        reason: `Refusing rebind: org '${referencingOrg.slug}' has destinationIds referencing target org.`,
      })
    }

    await ctx.db.delete(toOrg._id)
    await ctx.db.patch(fromOrg._id, {
      clerkOrgId: args.toClerkOrgId,
      updatedAt: Date.now(),
    })

    return {
      keptOrgId: fromOrg._id,
      deletedOrgId: toOrg._id,
      keptSlug: fromOrg.slug,
      newClerkOrgId: args.toClerkOrgId,
    }
  },
})
