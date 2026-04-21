import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { setUserOrganization } from '../lib/userOrg'

export const backfillPersonalOrgs = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const users = await ctx.db.query('users').collect() // bounded: dev only, small user count
    const now = Date.now()
    const results: Array<{ userId: string; slug: string; action: 'linked' | 'created' | 'skipped' }> = []

    for (const user of users) {
      if (user.organizationId) {
        results.push({ userId: user._id, slug: user.slug, action: 'skipped' })
        continue
      }

      const existingOrg = await ctx.db // batch-exempt: dev-only backfill iterates per user, small count
        .query('organizations')
        .withIndex('by_slug', (q) => q.eq('slug', user.slug))
        .unique()

      if (existingOrg) {
        await setUserOrganization(ctx, user._id, existingOrg._id) // batch-exempt: dev-only backfill
        results.push({ userId: user._id, slug: user.slug, action: 'linked' })
        continue
      }

      const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email || user.slug
      const orgId = await ctx.db.insert('organizations', { // batch-exempt: dev-only backfill, per-user sequential writes
        slug: user.slug,
        name: displayName,
        createdAt: now,
        updatedAt: now,
      })
      await setUserOrganization(ctx, user._id, orgId) // batch-exempt: dev-only backfill
      results.push({ userId: user._id, slug: user.slug, action: 'created' })
    }

    return results
  },
})
