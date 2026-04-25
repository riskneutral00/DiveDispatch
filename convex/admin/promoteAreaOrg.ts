import { mutation } from '../_generated/server'
import { v, ConvexError } from 'convex/values'
import { ErrorCode } from '../lib/errorCodes'
import { requireDevEnvironment } from '../lib/devGuard'

export const run = mutation({
  args: { slug: v.string() },
  returns: v.object({
    orgId: v.id('organizations'),
    name: v.string(),
    slug: v.string(),
    isAreaOrg: v.boolean(),
  }),
  handler: async (ctx, { slug }) => {
    requireDevEnvironment()

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()

    if (!org) {
      throw new ConvexError({
        code: ErrorCode.NOT_FOUND,
        reason: `No organization with slug '${slug}'`,
      })
    }

    await ctx.db.patch(org._id, { isAreaOrg: true, updatedAt: Date.now() })

    return {
      orgId: org._id,
      name: org.name,
      slug: org.slug,
      isAreaOrg: true,
    }
  },
})
