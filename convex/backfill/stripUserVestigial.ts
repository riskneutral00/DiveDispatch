import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'

export const stripUserVestigial = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const users = await ctx.db.query('users').collect() // bounded: dev-only one-shot backfill, full users table
    let stripped = 0
    for (const u of users) {
      const hasName = (u as { name?: string }).name !== undefined
      const hasOTI = (u as { originalTokenIdentifier?: string }).originalTokenIdentifier !== undefined
      if (!hasName && !hasOTI) continue
      await ctx.db.replace(u._id, { // batch-exempt: per-row replace with row-specific shape
        tokenIdentifier: u.tokenIdentifier,
        slug: u.slug,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        nickname: u.nickname,
        appLanguage: u.appLanguage,
        phone: u.phone,
        dateOfBirth: u.dateOfBirth,
        selectedThemeId: u.selectedThemeId,
        savedThemeIds: u.savedThemeIds,
        tcAcceptedAt: u.tcAcceptedAt,
        tcVersion: u.tcVersion,
        organizationId: u.organizationId,
      })
      stripped++
    }
    return { totalUsers: users.length, stripped }
  },
})
