import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id, TableNames } from '../_generated/dataModel'

export async function batchGet<T extends TableNames>(
  ctx: QueryCtx | MutationCtx,
  ids: Id<T>[],
): Promise<(Doc<T> | null)[]> {
  if (ids.length === 0) return []
  return Promise.all(ids.map((id) => ctx.db.get(id)))
}

export async function batchDelete<T extends TableNames>(
  ctx: MutationCtx,
  docs: Array<{ _id: Id<T> }>,
): Promise<void> {
  if (docs.length === 0) return
  await Promise.all(docs.map((d) => ctx.db.delete(d._id)))
}

export async function batchPatch<T extends TableNames>(
  ctx: MutationCtx,
  updates: Array<[Id<T>, Partial<Doc<T>>]>,
): Promise<void> {
  if (updates.length === 0) return
  await Promise.all(updates.map(([id, fields]) => ctx.db.patch(id, fields)))
}
