/**
 * Batch database operations — parallel wrappers around ctx.db methods.
 * Use these instead of sequential await-in-loop patterns (N+1).
 */

import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id, TableNames } from '../_generated/dataModel'

/**
 * Parallel ctx.db.get() for multiple IDs.
 * Replaces: `for (const id of ids) { await ctx.db.get(id) }`
 */
export async function batchGet<T extends TableNames>(
  ctx: QueryCtx | MutationCtx,
  ids: Id<T>[],
): Promise<(Doc<T> | null)[]> {
  if (ids.length === 0) return []
  return Promise.all(ids.map((id) => ctx.db.get(id)))
}

/**
 * Parallel ctx.db.delete() for multiple documents.
 * Replaces: `for (const doc of docs) { await ctx.db.delete(doc._id) }`
 */
export async function batchDelete<T extends TableNames>(
  ctx: MutationCtx,
  docs: Array<{ _id: Id<T> }>,
): Promise<void> {
  if (docs.length === 0) return
  await Promise.all(docs.map((d) => ctx.db.delete(d._id)))
}

/**
 * Parallel ctx.db.patch() for multiple documents.
 * Replaces: `for (const item of items) { await ctx.db.patch(item._id, fields) }`
 */
export async function batchPatch<T extends TableNames>(
  ctx: MutationCtx,
  updates: Array<[Id<T>, Partial<Doc<T>>]>,
): Promise<void> {
  if (updates.length === 0) return
  await Promise.all(updates.map(([id, fields]) => ctx.db.patch(id, fields)))
}
