import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { mutation } from './_generated/server'
import { requireAuth } from './lib/auth'
import { checkRateLimit } from './lib/rateLimiter'

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

export async function _submitSupportRequestHandler(
  ctx: MutationCtx,
  args: {
    subject: string
    category: string
    message: string
    screenshotFileId?: string
  },
): Promise<string> {
  const { user: caller } = await requireAuth(ctx)

  await checkRateLimit(ctx, 'submitSupportRequest', caller.slug)

  const id = await ctx.db.insert('supportRequests', {
    userId: caller.slug,
    subject: args.subject,
    category: args.category,
    message: args.message,
    screenshotFileId: args.screenshotFileId as Id<"_storage"> | undefined,
    status: 'Open',
    createdAt: Date.now(),
  })

  return id
}

export const submitSupportRequest = mutation({
  args: {
    subject: v.string(),
    category: v.string(),
    message: v.string(),
    screenshotFileId: v.optional(v.id('_storage')),
  },
  handler: _submitSupportRequestHandler,
})
