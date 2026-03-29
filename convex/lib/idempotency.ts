/**
 * Idempotency guard for offline mutation replay.
 *
 * Mutations that participate in the PWA offline queue check for a recent
 * idempotency log entry before executing. If a matching key exists, the
 * mutation short-circuits (no-op). Keys expire after 24 hours via a cron
 * purge job.
 */

import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'

/** TTL for idempotency keys: 24 hours in milliseconds (covers PWA offline overnight). */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Check whether a mutation with this idempotency key has already been executed.
 *
 * ATOMICITY GUARANTEE — Convex Serializable Transactions
 *
 * This function uses a read-then-insert pattern. Two concurrent calls with
 * the same (key, mutationName) pair are safe because Convex transactions are
 * serializable with OCC (Optimistic Concurrency Control):
 *
 * 1. Both transactions read the `by_key_mutationName` index and find no match.
 * 2. Both insert a new idempotencyLog record.
 * 3. Convex detects the read-set conflict (both read the same empty index range
 *    that one has now written to) and retries the losing transaction.
 * 4. On retry, the second transaction finds the first's record via the index
 *    query and returns `true` (duplicate detected).
 *
 * This guarantee is inherent to Convex's transaction model — it is not testable
 * via the sequential test harness, but is verified by Convex's runtime.
 * See: https://docs.convex.dev/database/advanced/occ
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
    .withIndex('by_key_mutationName', (q) =>
      q.eq('key', key).eq('mutationName', mutationName),
    )
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
 * Purge idempotency log entries older than 24 hours.
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
