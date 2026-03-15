import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireAuth, type AnyCtx } from './lib/auth'

// ─── generateUploadUrl ────────────────────────────────────────────────────────

export async function _generateUploadUrlHandler(ctx: AnyCtx): Promise<string> {
  await requireAuth(ctx)

  return await ctx.storage.generateUploadUrl()
}

export const generateUploadUrl = mutation({
  args: {},
  handler: _generateUploadUrlHandler,
})

// ─── submitSupportRequest ─────────────────────────────────────────────────────

export async function _submitSupportRequestHandler(
  ctx: AnyCtx,
  args: {
    subject: string
    category: string
    message: string
    screenshotFileId?: string
  },
): Promise<string> {
  const { user: caller } = await requireAuth(ctx)

  const id = await ctx.db.insert('supportRequests', {
    userId: caller.slug,
    subject: args.subject,
    category: args.category,
    message: args.message,
    screenshotFileId: args.screenshotFileId,
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
