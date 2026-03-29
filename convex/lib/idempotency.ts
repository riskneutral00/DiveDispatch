/**
 * Idempotency guard for offline mutation replay.
 *
 * Mutations that participate in the PWA offline queue check for a recent
 * idempotency log entry before executing. If a matching key exists, the
 * mutation short-circuits (no-op). Keys expire after 1 hour via a cron
 * purge job.
 */

import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'

/** TTL for idempotency keys: 1 hour in milliseconds. */
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000

/**
 * Check whether a mutation with this idempotency key has already been executed.
 *
 * @returns `true` if the key is a duplicate (caller should short-circuit),
 *          `false` if the key is fresh (caller should proceed and the key is now recorded).
 */
export async function checkIdempotency(
  ctx: MutationCtx,
  key: string,
  mutationName: string,
): Promise<boolean> {
  const existing = await ctx.db
    .query('idempotencyLog')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()

  if (existing) {
    return true
  }

  await ctx.db.insert('idempotencyLog', {
    key,
    mutationName,
    createdAt: Date.now(),
  })

  return false
}

/**
 * Purge idempotency log entries older than 1 hour.
 * Called by the cron scheduler — see convex/crons.ts.
 */
export const purgeExpiredIdempotencyKeys = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS
    const stale = await ctx.db
      .query('idempotencyLog')
      .withIndex('by_createdAt', (q) => q.lt('createdAt', cutoff))
      .take(1000)

    for (const entry of stale) {
      await ctx.db.delete(entry._id)
    }

    return stale.length
  },
})
