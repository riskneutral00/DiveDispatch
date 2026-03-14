import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

// ─── generateUploadUrl ────────────────────────────────────────────────────────

export async function _generateUploadUrlHandler(ctx: AnyCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

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
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

  const caller = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
  if (!caller) throw new ConvexError({ code: 'NOT_FOUND' })

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
