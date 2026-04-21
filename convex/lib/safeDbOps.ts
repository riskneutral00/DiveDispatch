import type { MutationCtx } from '../_generated/server'
import type { DataModel, TableNames } from '../_generated/dataModel'
import type { GenericId } from 'convex/values'

type AnyTablePatch = {
  [T in TableNames]: Partial<DataModel[T]['document']>
}[TableNames]

export async function safePatchIfExists<T extends TableNames>(
  ctx: MutationCtx,
  id: GenericId<T>,
  patch: AnyTablePatch,
): Promise<boolean> {
  const existing = await ctx.db.get(id)
  if (!existing) return false
  await ctx.db.patch(id, patch as unknown as Partial<DataModel[T]['document']>)
  return true
}

export async function safeDeleteIfExists<T extends TableNames>(
  ctx: MutationCtx,
  id: GenericId<T>,
): Promise<boolean> {
  const existing = await ctx.db.get(id)
  if (!existing) return false
  await ctx.db.delete(id)
  return true
}
