import { ConvexError } from 'convex/values'
import { v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { normalizeAppLanguage, normalizeEmail } from '../lib/validators'
import { SUPPORTED_LOCALE_CODES } from '../shared/i18nConstants'

export const audit = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect() // bounded: dev/audit
    const blankEmail: Array<{ id: string; slug: string; tokenIdentifier: string }> = []
    const nonCanonicalLocale: Array<{ id: string; slug: string; appLanguage: string }> = []
    const dupes = new Map<string, string[]>()

    for (const u of users) {
      const norm = normalizeEmail(u.email ?? '')
      if (norm === '') blankEmail.push({ id: u._id, slug: u.slug, tokenIdentifier: u.tokenIdentifier })
      else {
        const arr = dupes.get(norm) ?? []
        arr.push(u._id)
        dupes.set(norm, arr)
      }
      const al = u.appLanguage ?? ''
      if (al !== '' && !SUPPORTED_LOCALE_CODES.has(al)) {
        nonCanonicalLocale.push({ id: u._id, slug: u.slug, appLanguage: al })
      }
    }

    const duplicateNormalizedEmails = [...dupes.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([email, ids]) => ({ email, ids }))

    return {
      totalUsers: users.length,
      blankEmailCount: blankEmail.length,
      nonCanonicalLocaleCount: nonCanonicalLocale.length,
      duplicateEmailCount: duplicateNormalizedEmails.length,
      blankEmail,
      nonCanonicalLocale,
      duplicateNormalizedEmails,
    }
  },
})

export const backfillCanonicalLocales = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = false }) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }
    const users = await ctx.db.query('users').collect() // bounded: dev backfill
    const repaired: Array<{ id: string; slug: string; from: string; to: string }> = []
    for (const u of users) {
      const al = u.appLanguage ?? ''
      if (al === '' || SUPPORTED_LOCALE_CODES.has(al)) continue
      const canonical = normalizeAppLanguage(al)
      repaired.push({ id: u._id, slug: u.slug, from: al, to: canonical })
      if (!dryRun) await ctx.db.patch(u._id, { appLanguage: canonical }) // batch-exempt: dev backfill
    }
    return { dryRun, repairedCount: repaired.length, repaired }
  },
})
