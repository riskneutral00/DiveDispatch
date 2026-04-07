import { ConvexError, v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import { mutation } from './_generated/server'
import { requireAuth } from './lib/auth'
import { checkRateLimit } from './lib/rateLimiter'
import { ErrorCode } from './lib/errorCodes'
import { sanitizeString, SHORT_TEXT_MAX, SUPPORT_MESSAGE_MAX } from './lib/sanitize'

const supportCategoryValidator = v.union(
  v.literal('Bug'),
  v.literal('Feature Request'),
  v.literal('Question'),
  v.literal('Account Issue'),
)

// ─── generateUploadUrl ────────────────────────────────────────────────────────

export async function _generateUploadUrlHandler(ctx: MutationCtx): Promise<string> {
  const { user: caller } = await requireAuth(ctx)

  await checkRateLimit(ctx, 'generateUploadUrl', caller.slug)

  return await ctx.storage.generateUploadUrl()
}

export const generateUploadUrl = mutation({
  args: {},
  handler: _generateUploadUrlHandler,
})

// ─── submitSupportRequest ─────────────────────────────────────────────────────

export const submitSupportRequest = mutation({
  args: {
    subject: v.string(),
    category: supportCategoryValidator,
    message: v.string(),
    screenshotStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const { user: caller } = await requireAuth(ctx)
    await checkRateLimit(ctx, 'submitSupportRequest', caller.slug)

    const subject = sanitizeString(args.subject, SHORT_TEXT_MAX)
    const message = sanitizeString(args.message, SUPPORT_MESSAGE_MAX)

    if (!subject) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'Subject is required.' })
    }
    if (!message) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'Message is required.' })
    }
    if (message.length < 10) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: 'Message must be at least 10 characters.',
      })
    }

    if (args.screenshotStorageId) {
      const url = await ctx.storage.getUrl(args.screenshotStorageId)
      if (url === null) {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'Invalid screenshot upload.' })
      }
    }

    await ctx.db.insert('supportRequests', {
      userId: caller._id,
      userSlug: caller.slug,
      subject,
      category: args.category,
      message,
      screenshotStorageId: args.screenshotStorageId,
      createdAt: Date.now(),
    })
  },
})
