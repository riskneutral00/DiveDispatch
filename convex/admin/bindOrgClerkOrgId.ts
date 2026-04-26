import { mutation } from '../_generated/server'
import { v, ConvexError } from 'convex/values'
import { ErrorCode } from '../lib/errorCodes'
import { requireDevEnvironment } from '../lib/devGuard'

export const run = mutation({
  args: {
    orgSlug: v.string(),
    clerkOrgId: v.string(),
  },
  returns: v.object({
    orgId: v.id('organizations'),
    slug: v.string(),
    clerkOrgId: v.string(),
    changed: v.boolean(),
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

    if (org.clerkOrgId === args.clerkOrgId) {
      return {
        orgId: org._id,
        slug: org.slug,
        clerkOrgId: args.clerkOrgId,
        changed: false,
      }
    }

    if (org.clerkOrgId !== undefined) {
      throw new ConvexError({
        code: ErrorCode.CONFLICT,
        reason: `Org '${args.orgSlug}' already bound to '${org.clerkOrgId}'. Use rebindOrgClerkOrgId for a different target.`,
      })
    }

    await ctx.db.patch(org._id, {
      clerkOrgId: args.clerkOrgId,
      updatedAt: Date.now(),
    })

    return {
      orgId: org._id,
      slug: org.slug,
      clerkOrgId: args.clerkOrgId,
      changed: true,
    }
  },
})
