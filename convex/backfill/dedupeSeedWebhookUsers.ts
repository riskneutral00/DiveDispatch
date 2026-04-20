import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'

export const dedupeSeedWebhookUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const users = await ctx.db.query('users').collect() // bounded: dev only, small user count
    const byEmail = new Map<string, typeof users>()
    for (const u of users) {
      if (!u.email) continue
      const list = byEmail.get(u.email) ?? []
      list.push(u)
      byEmail.set(u.email, list)
    }

    const actions: Array<{ email: string; kept: string; deleted: string; newTokenIdentifier: string }> = []

    for (const [email, rows] of byEmail) {
      if (rows.length < 2) continue
      const seedRow = rows.find((r) => r.tokenIdentifier.startsWith('seed|'))
      const clerkRow = rows.find((r) => !r.tokenIdentifier.startsWith('seed|'))
      if (!seedRow || !clerkRow || rows.length !== 2) continue

      const clerkRoles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', clerkRow._id))
        .collect() // bounded: per-user roles
      if (clerkRoles.length > 0) continue
      if (clerkRow.organizationId) continue

      await ctx.db.delete(clerkRow._id) // batch-exempt: dev-only cleanup, tiny set (one per duplicated email)
      await ctx.db.patch(seedRow._id, { tokenIdentifier: clerkRow.tokenIdentifier }) // batch-exempt: dev-only cleanup

      actions.push({
        email,
        kept: seedRow._id,
        deleted: clerkRow._id,
        newTokenIdentifier: clerkRow.tokenIdentifier,
      })
    }

    return { actions }
  },
})
