import { mutation } from '../_generated/server'
import { v, ConvexError } from 'convex/values'
import { ErrorCode } from '../lib/errorCodes'
import { requireDevEnvironment } from '../lib/devGuard'
import { SOFT_DELETE_TTL_MS } from '../lib/orgCascade'

export const run = mutation({
  args: {
    orgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.id('organizations'),
    slug: v.string(),
    restored: v.boolean(),
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

    if (org.deletedAt === undefined) {
      return { orgId: org._id, slug: org.slug, restored: false }
    }

    const now = Date.now()
    if (org.deletedAt < now - SOFT_DELETE_TTL_MS) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'restore_window_elapsed',
      })
    }

    await ctx.db.patch(org._id, {
      deletedAt: undefined,
      updatedAt: now,
    })

    await ctx.db.insert('webhookAuditLog', {
      eventType: 'org_cascade_restored',
      orgId: org._id,
      orgName: org.name,
      orgSlug: org.slug,
      at: now,
    })

    return { orgId: org._id, slug: org.slug, restored: true }
  },
})
