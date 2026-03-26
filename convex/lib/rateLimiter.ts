/**
 * Token-bucket rate limiter backed by the `rateLimits` Convex table.
 *
 * Each named limit has a max token count and a refill window. On every call,
 * tokens are refilled proportionally to elapsed time, then one token is consumed.
 * If no tokens remain, a ConvexError with RATE_LIMITED code is thrown.
 *
 * All state lives in the same mutation transaction — no external dependencies.
 */

import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from './errorCodes'

/** Needs db write access — accepts MutationCtx or any superset with a compatible db. */
type RateLimitCtx = { db: MutationCtx['db'] }

// ── Limit Definitions ─────────────────────────────────────────────────────────

interface RateLimitConfig {
  /** Maximum tokens (burst capacity) */
  maxTokens: number
  /** Window in milliseconds over which all tokens refill */
  windowMs: number
}

const LIMITS = {
  submitSupportRequest: { maxTokens: 5, windowMs: 60_000 },
  savePortalContact: { maxTokens: 10, windowMs: 60_000 },
  saveMedicalAnswers: { maxTokens: 10, windowMs: 60_000 },
  savePortalWaiver: { maxTokens: 10, windowMs: 60_000 },
  savePortalEquipment: { maxTokens: 10, windowMs: 60_000 },
  saveWaiver: { maxTokens: 10, windowMs: 60_000 },
  saveEquipmentData: { maxTokens: 10, windowMs: 60_000 },
  submitPortal: { maxTokens: 3, windowMs: 60_000 },
  saveSafetyInfo: { maxTokens: 10, windowMs: 60_000 },
  generateUploadUrl: { maxTokens: 10, windowMs: 60_000 },
  createUser: { maxTokens: 3, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitName = keyof typeof LIMITS

// ── Core Check ────────────────────────────────────────────────────────────────

/**
 * Consume one token from the named rate limit bucket for the given key.
 * Throws ConvexError({ code: 'RATE_LIMITED' }) if no tokens remain.
 *
 * @param ctx  - Convex MutationCtx (needs db access)
 * @param name - One of the defined limit names
 * @param key  - Caller identifier (userId, token, IP, etc.)
 */
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
    // First request — create bucket with one token consumed
    await ctx.db.insert('rateLimits', {
      key: bucketKey,
      tokens: config.maxTokens - 1,
      lastRefill: now,
    })
    return
  }

  // Calculate refilled tokens based on elapsed time
  const elapsed = now - existing.lastRefill
  const refillRate = config.maxTokens / config.windowMs
  const refilled = Math.min(
    config.maxTokens,
    existing.tokens + elapsed * refillRate,
  )

  if (refilled < 1) {
    throw new ConvexError({ code: ErrorCode.RATE_LIMITED })
  }

  // Consume one token
  await ctx.db.patch(existing._id, {
    tokens: refilled - 1,
    lastRefill: now,
  })
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

/** Maximum window across all limits — entries older than this are fully refilled and safe to purge. */
const MAX_WINDOW_MS = Math.max(...Object.values(LIMITS).map((l) => l.windowMs))

/**
 * Purges stale rate limit entries whose last refill is older than 2x the max window.
 * Portal token UUIDs as keys would otherwise cause unbounded table growth.
 * Runs as a scheduled cron — see convex/crons.ts.
 */
export const purgeStaleRateLimits = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const cutoff = Date.now() - MAX_WINDOW_MS * 2
    const stale = await ctx.db
      .query('rateLimits')
      .filter((q) => q.lt(q.field('lastRefill'), cutoff))
      .take(1000)

    for (const entry of stale) {
      await ctx.db.delete(entry._id)
    }

    return stale.length
  },
})
