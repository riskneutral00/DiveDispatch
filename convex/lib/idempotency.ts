import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

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
