import type { MutationCtx } from './_generated/server'
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
