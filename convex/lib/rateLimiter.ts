import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from './errorCodes'

type RateLimitCtx = { db: MutationCtx['db'] }

interface RateLimitConfig {
  maxTokens: number
  windowMs: number
}

const LIMITS = {
  submitSupportRequest: { maxTokens: 5, windowMs: 60_000 },
  savePortalContact: { maxTokens: 10, windowMs: 60_000 },
  saveMedicalAnswers: { maxTokens: 10, windowMs: 60_000 },
  savePortalWaiver: { maxTokens: 10, windowMs: 60_000 },
  savePortalEquipment: { maxTokens: 10, windowMs: 60_000 },
  saveEquipmentData: { maxTokens: 10, windowMs: 60_000 },
  submitPortal: { maxTokens: 3, windowMs: 60_000 },
  saveSafetyInfo: { maxTokens: 10, windowMs: 60_000 },
  createUser: { maxTokens: 3, windowMs: 60_000 },
  submitToDraft: { maxTokens: 10, windowMs: 60_000 },
  cancelBooking: { maxTokens: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitName = keyof typeof LIMITS

export async function checkRateLimit(
  ctx: RateLimitCtx,
  name: RateLimitName,
  key: string,
): Promise<void> {
  const config = LIMITS[name]
  const bucketKey = `${name}:${key}`
  const now = Date.now()

  const existing = await ctx.db
    .query('rateLimits')
    .withIndex('by_key', (q) => q.eq('key', bucketKey))
    .unique()

  if (!existing) {
    await ctx.db.insert('rateLimits', {
      key: bucketKey,
      tokens: config.maxTokens - 1,
      lastRefill: now,
    })
    return
  }

  const elapsed = now - existing.lastRefill
  const refillRate = config.maxTokens / config.windowMs
  const refilled = Math.min(
    config.maxTokens,
    existing.tokens + elapsed * refillRate,
  )

  if (refilled < 1) {
    throw new ConvexError({ code: ErrorCode.RATE_LIMITED })
  }

  await ctx.db.patch(existing._id, {
    tokens: refilled - 1,
    lastRefill: now,
  })
}

const MAX_WINDOW_MS = Math.max(...Object.values(LIMITS).map((l) => l.windowMs))

export const purgeStaleRateLimits = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const cutoff = Date.now() - MAX_WINDOW_MS * 2
    const stale = await ctx.db
      .query('rateLimits')
      .withIndex('by_lastRefill', (q) => q.lt('lastRefill', cutoff))
      .take(1000)

    for (const entry of stale) {
      await ctx.db.delete(entry._id) // batch-exempt: bounded by .take(1000), simple sequential delete
    }

    return stale.length
  },
})
